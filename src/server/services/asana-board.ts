import { desc, isNotNull } from "drizzle-orm";
import { getDb } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { getAsanaTask, listProjectTasks, type AsanaTask } from "@/server/integrations/asana";
import { lastSync, syncedTasks } from "./asana-sync";
import { getIntegration } from "./settings";

export type KanbanCard = {
  id: string;
  title: string;
  poId?: string;
  poNumber?: string;
  vendor?: string;
  total?: number;
  status?: string;
  requester?: string;
  dueOn?: string | null;
  completed: boolean;
  url?: string;
  source: "erp" | "asana" | "demo";
  gid?: string;
};
export type KanbanColumn = { key: string; label: string; tone: "warn" | "blue" | "sky" | "ok" | "neutral"; cards: KanbanCard[] };

/* Board columns follow the PO lifecycle so the Asana view and the ERP agree.
   Cards come from POs that have an Asana task (live status is fetched when a
   PAT is configured), plus any other tasks in the mapped project. */
export async function asanaBoard(): Promise<{ columns: KanbanColumn[]; mode: "live" | "demo"; integration: Awaited<ReturnType<typeof getIntegration>>; sync: { at: Date | null; n: number } }> {
  const db = getDb();
  const integration = await getIntegration("asana");
  const live = integration.enabled && integration.hasSecret && process.env.INTEGRATIONS_MOCK !== "1";
  const sync = await lastSync();
  const mirror = sync.n > 0 ? await syncedTasks() : [];
  const pos = await db.query.purchaseOrders.findMany({
    where: isNotNull(purchaseOrders.asanaTaskGid),
    with: { vendor: true, requester: { columns: { name: true } } },
    orderBy: [desc(purchaseOrders.updatedAt)],
    limit: 60,
  });
  const cards: KanbanCard[] = [];
  const seen = new Set<string>();
  for (const po of pos) {
    let task: AsanaTask | null = null;
    const m = mirror.find((x) => x.gid === po.asanaTaskGid);
    if (m) task = { gid: m.gid, name: m.name, completed: m.completed, permalink_url: m.permalinkUrl, due_on: m.dueOn };
    else if (live && po.asanaTaskGid && !po.asanaTaskGid.startsWith("mock")) task = await getAsanaTask(po.asanaTaskGid);
    if (po.asanaTaskGid) seen.add(po.asanaTaskGid);
    cards.push({
      id: po.id,
      title: task?.name ?? `Approve ${po.poNumber} · ${po.vendor.name}`,
      poId: po.id,
      poNumber: po.poNumber,
      vendor: po.vendor.name,
      total: po.total,
      status: po.status,
      requester: po.requester?.name,
      dueOn: task?.due_on ?? po.neededBy,
      completed: task ? task.completed : po.status !== "pending_approval",
      url: task?.permalink_url,
      source: live ? "asana" : "demo",
      gid: po.asanaTaskGid ?? undefined,
    });
  }
  const extra: AsanaTask[] = mirror.length ? mirror.map((m) => ({ gid: m.gid, name: m.name, completed: m.completed, due_on: m.dueOn, permalink_url: m.permalinkUrl })) : live ? await listProjectTasks() : [];
  for (const t of extra) {
    if (seen.has(t.gid)) continue;
    cards.push({ id: t.gid, title: t.name, completed: t.completed, dueOn: t.due_on, url: t.permalink_url, source: "asana", gid: t.gid });
  }
  const col = (key: string, label: string, tone: KanbanColumn["tone"], pred: (c: KanbanCard) => boolean): KanbanColumn => ({ key, label, tone, cards: cards.filter(pred) });
  const columns = [
    col("todo", "To do · awaiting approval", "warn", (c) => c.status === "pending_approval" || (!c.status && !c.completed)),
    col("approved", "Approved · to order", "blue", (c) => c.status === "approved"),
    col("ordered", "In progress · ordered", "sky", (c) => c.status === "ordered"),
    col("done", "Done", "ok", (c) => ["received", "closed"].includes(c.status ?? "") || (!c.status && c.completed)),
    col("stopped", "Rejected / cancelled", "neutral", (c) => ["rejected", "cancelled"].includes(c.status ?? "")),
  ];
  return { columns, mode: live ? "live" : "demo", integration, sync };
}
