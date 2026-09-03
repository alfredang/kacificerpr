import { and, desc, eq, lte, sql } from "drizzle-orm";
import { CronExpressionParser } from "cron-parser";
import { getDb } from "@/db";
import { scheduledTaskRuns, scheduledTasks } from "@/db/schema";
import type { TaskKind } from "@/lib/constants";
import { audit, type Actor } from "./audit";
import { runJob } from "@/server/jobs";

export function nextRun(cronExpr: string, timezone: string, from = new Date()) {
  const it = CronExpressionParser.parse(cronExpr, { currentDate: from, tz: timezone });
  return it.next().toDate();
}

export function nextRuns(cronExpr: string, timezone: string, n = 3) {
  try {
    const it = CronExpressionParser.parse(cronExpr, { currentDate: new Date(), tz: timezone });
    return Array.from({ length: n }, () => it.next().toDate());
  } catch {
    return [];
  }
}

export function describeCron(expr: string) {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "Invalid expression";
  const [m, h, dom, mon, dow] = parts;
  if (m.startsWith("*/") && h === "*" && dom === "*" && mon === "*" && dow === "*") return `Every ${m.slice(2)} minutes`;
  if (/^\d+$/.test(m) && /^\d+$/.test(h)) {
    const time = `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
    if (dow === "1-5" && dom === "*") return `Weekdays at ${time}`;
    if (dow === "*" && dom === "*") return `Daily at ${time}`;
    if (/^\d$/.test(dow) && dom === "*") return `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][Number(dow)]} at ${time}`;
    if (/^\d+$/.test(dom) && dow === "*") return `Monthly on day ${dom} at ${time}`;
  }
  return "Custom schedule";
}

export async function listTasks() {
  return getDb().query.scheduledTasks.findMany({ orderBy: [desc(scheduledTasks.enabled), scheduledTasks.name], with: { runs: { orderBy: [desc(scheduledTaskRuns.startedAt)], limit: 8 } } });
}

export async function saveTask(input: { name: string; kind: TaskKind; cronExpr: string; timezone: string; enabled: boolean; config?: Record<string, unknown> }, actor: Actor, id?: string) {
  const db = getDb();
  const next = nextRun(input.cronExpr, input.timezone);
  const values = { ...input, config: input.config ?? {}, nextRunAt: next, updatedAt: new Date() };
  const [row] = id
    ? await db.update(scheduledTasks).set(values).where(eq(scheduledTasks.id, id)).returning()
    : await db.insert(scheduledTasks).values({ ...values, createdBy: actor.id ?? null }).returning();
  await audit({ actor, action: id ? "task.update" : "task.create", entityType: "scheduled_task", entityId: row.id, payload: { name: input.name, cron: input.cronExpr, enabled: input.enabled } });
  return row;
}

export async function deleteTask(id: string, actor: Actor) {
  await getDb().delete(scheduledTasks).where(eq(scheduledTasks.id, id));
  await audit({ actor, action: "task.delete", entityType: "scheduled_task", entityId: id });
}

/* Claim-then-run: the UPDATE … WHERE next_run_at <= now RETURNING is the lock,
   so two overlapping ticks cannot both execute the same task. */
export async function runDueTasks(trigger = "cron") {
  const db = getDb();
  const now = new Date();
  const due = await db
    .select()
    .from(scheduledTasks)
    .where(and(eq(scheduledTasks.enabled, true), lte(scheduledTasks.nextRunAt, now)));
  const results: { id: string; name: string; status: string }[] = [];
  for (const t of due) {
    const [claimed] = await db
      .update(scheduledTasks)
      .set({ nextRunAt: nextRun(t.cronExpr, t.timezone, now), lastRunAt: now })
      .where(and(eq(scheduledTasks.id, t.id), lte(scheduledTasks.nextRunAt, now)))
      .returning();
    if (!claimed) continue;
    results.push(await executeTask(t.id, trigger));
  }
  // Tasks created without next_run_at (older rows) get one.
  await db.update(scheduledTasks).set({ nextRunAt: sql`now()` }).where(sql`${scheduledTasks.nextRunAt} is null`);
  return results;
}

export async function executeTask(id: string, trigger = "manual") {
  const db = getDb();
  const task = await db.query.scheduledTasks.findFirst({ where: eq(scheduledTasks.id, id) });
  if (!task) throw new Error("Task not found");
  const [run] = await db.insert(scheduledTaskRuns).values({ taskId: id, trigger }).returning();
  let status: "ok" | "failed" = "ok";
  let log = "";
  try {
    log = await runJob(task.kind, task.config);
  } catch (err) {
    status = "failed";
    log = err instanceof Error ? err.message : String(err);
  }
  await db.update(scheduledTaskRuns).set({ finishedAt: new Date(), status, log }).where(eq(scheduledTaskRuns.id, run.id));
  await db.update(scheduledTasks).set({ lastRunAt: new Date(), lastStatus: status, nextRunAt: nextRun(task.cronExpr, task.timezone) }).where(eq(scheduledTasks.id, id));
  return { id, name: task.name, status, log };
}
