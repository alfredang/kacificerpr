import { desc, eq, ilike, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { asanaTasks, purchaseOrders } from "@/db/schema";
import { asanaEnabled, asanaProjectGid, listProjectTasks } from "@/server/integrations/asana";
import { decidePo } from "./po";
import { audit, type Actor } from "./audit";

/* Pulls the approvals project from Asana into asana_tasks (upsert by gid), links
   tasks to POs (by stored gid or by PO number in the task name) and, when a
   task linked to a pending PO was completed in Asana, approves that PO. This is
   what "Sync now" and the asana_sync scheduled task run. */
export async function syncAsana(actor: Actor) {
  if (!(await asanaEnabled())) return { ok: false as const, message: "Asana is not enabled — add a personal access token under Settings → Integrations." };
  const projectGid = await asanaProjectGid();
  if (!projectGid) return { ok: false as const, message: "No Asana project configured — run Test connection to create one." };
  const db = getDb();
  const tasks = await listProjectTasks(100);
  const pos = await db.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, status: purchaseOrders.status, gid: purchaseOrders.asanaTaskGid }).from(purchaseOrders);
  let linked = 0;
  let approved = 0;
  for (const t of tasks) {
    let po = pos.find((p) => p.gid === t.gid) ?? null;
    if (!po) {
      const m = t.name.match(/PO-\d{4}-\d{4}/);
      if (m) po = pos.find((p) => p.poNumber === m[0]) ?? null;
      if (po && !po.gid) await db.update(purchaseOrders).set({ asanaTaskGid: t.gid }).where(eq(purchaseOrders.id, po.id));
    }
    if (po) linked += 1;
    await db
      .insert(asanaTasks)
      .values({
        gid: t.gid,
        name: t.name,
        notes: t.notes ?? "",
        completed: t.completed,
        completedAt: t.completed_at ? new Date(t.completed_at) : null,
        dueOn: t.due_on ?? null,
        assignee: t.assignee?.name ?? "",
        section: t.memberships?.[0]?.section?.name ?? "",
        permalinkUrl: t.permalink_url ?? "",
        projectGid,
        poId: po?.id ?? null,
        modifiedAt: t.modified_at ? new Date(t.modified_at) : null,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: asanaTasks.gid,
        set: { name: t.name, notes: t.notes ?? "", completed: t.completed, completedAt: t.completed_at ? new Date(t.completed_at) : null, dueOn: t.due_on ?? null, assignee: t.assignee?.name ?? "", section: t.memberships?.[0]?.section?.name ?? "", permalinkUrl: t.permalink_url ?? "", poId: po?.id ?? null, modifiedAt: t.modified_at ? new Date(t.modified_at) : null, syncedAt: new Date() },
      });
    if (po && po.status === "pending_approval" && t.completed) {
      await decidePo(po.id, "approve", { actor: { type: "system", label: "Asana sync" }, role: "admin", note: `Task completed in Asana${t.assignee?.name ? ` by ${t.assignee.name}` : ""}`, approverId: null, via: "asana" });
      approved += 1;
    }
  }
  // Tasks deleted in Asana disappear from the mirror.
  const gids = tasks.map((t) => t.gid);
  if (gids.length) await db.delete(asanaTasks).where(sql`${asanaTasks.projectGid} = ${projectGid} and ${asanaTasks.gid} <> all(${gids})`);
  else await db.delete(asanaTasks).where(eq(asanaTasks.projectGid, projectGid));
  await audit({ actor, action: "asana.sync", entityType: "integration", entityId: "asana", payload: { tasks: tasks.length, linked, approved } });
  return { ok: true as const, message: `Synced ${tasks.length} task(s) from Asana · ${linked} linked to POs · ${approved} PO(s) approved from Asana.`, tasks: tasks.length, linked, approved };
}

export async function syncedTasks() {
  return getDb().query.asanaTasks.findMany({ orderBy: [desc(asanaTasks.modifiedAt)] });
}

export async function lastSync() {
  const [row] = await getDb().select({ at: sql<Date | null>`max(${asanaTasks.syncedAt})`, n: sql<number>`count(*)` }).from(asanaTasks);
  return { at: row?.at ? new Date(row.at) : null, n: Number(row?.n ?? 0) };
}

export async function searchSyncedTasks(q: string) {
  return getDb().select().from(asanaTasks).where(ilike(asanaTasks.name, `%${q}%`)).limit(20);
}
