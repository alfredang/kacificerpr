import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { purchaseOrders, users } from "@/db/schema";
import type { TaskKind } from "@/lib/constants";
import { money, num } from "@/lib/format";
import { digestEmail, sendEmail } from "@/server/integrations/email";
import { getAsanaTask } from "@/server/integrations/asana";
import { emit } from "@/server/events";
import { retryDue } from "@/server/webhooks/deliver";
import { appUrl } from "@/server/services/auth";
import { overdueInvoices } from "@/server/services/invoice";
import { lowStockList } from "@/server/services/sku";
import { decidePo } from "@/server/services/po";
import { runAgent } from "@/server/agents/runner";

/* One function per scheduled task kind. Each returns a short log line that is
   stored on the run. Jobs are idempotent and safe to re-run. */
async function managers() {
  return getDb().select().from(users).where(and(inArray(users.role, ["manager", "admin"]), eq(users.isActive, true), eq(users.isServiceAccount, false)));
}

const JOBS: Record<TaskKind, (config: Record<string, unknown>) => Promise<string>> = {
  async low_stock_scan() {
    const low = await lowStockList();
    if (low.length === 0) return "All SKUs above reorder level.";
    await emit("stock.low", { count: low.length, items: low.slice(0, 50).map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, reorderLevel: l.reorderLevel, suggestedQty: l.suggestedQty, vendor: l.vendor?.name })) });
    const to = (await managers()).map((m) => m.email);
    if (to.length) {
      const mail = digestEmail({
        title: `Low stock: ${low.length} SKU${low.length === 1 ? "" : "s"} below reorder level`,
        intro: "Network-wide on-hand quantities below the reorder level, most urgent first.",
        items: low.slice(0, 15).map((l) => `${l.sku} ${l.name}: ${num(l.qty)} on hand, reorder at ${num(l.reorderLevel)}, suggest ${num(l.suggestedQty)}${l.vendor ? ` from ${l.vendor.name}` : ""}`),
        viewUrl: appUrl("/low-stock"),
        cta: "Open low-stock list",
      });
      await sendEmail({ to, ...mail });
    }
    return `${low.length} low-stock SKUs; stock.low emitted; digest to ${to.length} manager(s).`;
  },

  async reorder_agent() {
    const run = await runAgent("reorder", {}, null);
    return run.status === "failed" ? `Agent failed: ${run.error}` : `Proposal ${run.id} created (${run.status}) — review on the Agents page.`;
  },

  async overdue_invoice_reminder() {
    const overdue = await overdueInvoices();
    if (overdue.length === 0) return "No overdue invoices.";
    const to = (await getDb().select().from(users).where(and(inArray(users.role, ["finance", "admin"]), eq(users.isActive, true), eq(users.isServiceAccount, false)))).map((u) => u.email);
    const mail = digestEmail({
      title: `${overdue.length} vendor invoice${overdue.length === 1 ? "" : "s"} overdue`,
      intro: "Invoices past their due date that are not yet paid.",
      items: overdue.map((i) => `${i.invoiceNumber} · ${i.vendor.name} · ${money(i.total)} · due ${i.dueAt}`),
      viewUrl: appUrl("/invoices?status=approved"),
      cta: "Open invoices",
    });
    if (to.length) await sendEmail({ to, ...mail });
    return `${overdue.length} overdue; reminder to ${to.length} finance user(s).`;
  },

  async asana_sync() {
    const db = getDb();
    const pending = await db.query.purchaseOrders.findMany({ where: eq(purchaseOrders.status, "pending_approval") });
    let applied = 0;
    for (const po of pending) {
      if (!po.asanaTaskGid) continue;
      const task = await getAsanaTask(po.asanaTaskGid);
      if (task?.completed) {
        // A task completed in Asana counts as approval by the Asana integration.
        await decidePo(po.id, "approve", { actor: { type: "system", label: "Asana sync" }, role: "admin", note: "Task completed in Asana", approverId: null, via: "asana" });
        applied += 1;
      }
    }
    return `${pending.length} pending PO(s) checked; ${applied} approved from Asana.`;
  },

  async daily_digest() {
    const db = getDb();
    const pending = await db.query.purchaseOrders.findMany({ where: eq(purchaseOrders.status, "pending_approval"), with: { vendor: true } });
    const low = await lowStockList();
    const overdue = await overdueInvoices();
    const to = (await managers()).map((m) => m.email);
    if (!to.length) return "No managers to email.";
    const mail = digestEmail({
      title: "Kacific ERP daily digest",
      intro: `${pending.length} PO(s) awaiting approval · ${low.length} low-stock SKU(s) · ${overdue.length} overdue invoice(s).`,
      items: [...pending.map((p) => `Approve ${p.poNumber} · ${p.vendor.name} · ${money(p.total)}`), ...low.slice(0, 5).map((l) => `Low: ${l.sku} (${num(l.qty)}/${num(l.reorderLevel)})`)],
      viewUrl: appUrl("/dashboard"),
      cta: "Open dashboard",
    });
    await sendEmail({ to, ...mail });
    return `Digest sent to ${to.length} manager(s).`;
  },

  async webhook_retry() {
    const n = await retryDue();
    return `${n} delivery(ies) retried.`;
  },
};

export async function runJob(kind: TaskKind, config: Record<string, unknown>) {
  const job = JOBS[kind];
  if (!job) throw new Error(`Unknown job kind ${kind}`);
  return job(config);
}
