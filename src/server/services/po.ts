import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { companySettings, invoices, purchaseOrderLines, purchaseOrders, users, type PurchaseOrder, type User } from "@/db/schema";
import { APPROVAL_TOKEN_TTL_HOURS, type PoStatus } from "@/lib/constants";
import { money } from "@/lib/format";
import { ACTION_ROLES, EDITABLE_STATUSES, lineTotal, poTotals, transition, type PoAction } from "@/lib/po-status";
import { consumeToken, issueToken, voidPoTokens } from "@/server/security/tokens";
import { approvalRequestEmail, decisionEmail, sendEmail } from "@/server/integrations/email";
import { asanaEnabled, commentAsanaTask, completeAsanaTask, createAsanaTask } from "@/server/integrations/asana";
import { emit, recordPoEvent } from "@/server/events";
import { audit, type Actor } from "./audit";
import { appUrl } from "./auth";
import { adjustStock } from "./sku";

export function userActor(user: Pick<User, "id" | "name" | "email">): Actor {
  return { type: "user", id: user.id, label: user.name || user.email };
}

export class PoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PoError";
  }
}

export type PoLineInput = { skuId?: string | null; description: string; qty: number; unitCost: number };
export type PoInput = {
  vendorId: string;
  warehouseId: string;
  neededBy?: string | null;
  notes?: string;
  lines: PoLineInput[];
  source?: PurchaseOrder["source"];
  currency?: string;
};

export async function listPos(opts: { status?: PoStatus | PoStatus[]; q?: string; vendorId?: string; requesterId?: string; limit?: number } = {}) {
  const db = getDb();
  const where = [];
  if (opts.status) where.push(Array.isArray(opts.status) ? inArray(purchaseOrders.status, opts.status) : eq(purchaseOrders.status, opts.status));
  if (opts.vendorId) where.push(eq(purchaseOrders.vendorId, opts.vendorId));
  if (opts.requesterId) where.push(eq(purchaseOrders.requesterId, opts.requesterId));
  if (opts.q) where.push(or(ilike(purchaseOrders.poNumber, `%${opts.q}%`), ilike(purchaseOrders.notes, `%${opts.q}%`)));
  return db.query.purchaseOrders.findMany({
    where: where.length ? and(...where) : undefined,
    with: { vendor: true, warehouse: true, requester: { columns: { id: true, name: true, email: true } } },
    orderBy: [desc(purchaseOrders.createdAt)],
    limit: opts.limit ?? 200,
  });
}

export async function getPo(idOrNumber: string) {
  const db = getDb();
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrNumber);
  return db.query.purchaseOrders.findFirst({
    where: isUuid ? eq(purchaseOrders.id, idOrNumber) : eq(purchaseOrders.poNumber, idOrNumber.toUpperCase()),
    with: {
      vendor: true,
      warehouse: true,
      requester: { columns: { id: true, name: true, email: true } },
      approver: { columns: { id: true, name: true, email: true } },
      lines: { with: { sku: true }, orderBy: (l, { asc }) => [asc(l.lineNo)] },
      events: { orderBy: (e, { asc }) => [asc(e.createdAt)] },
      invoices: true,
    },
  });
}
export type PoDetail = NonNullable<Awaited<ReturnType<typeof getPo>>>;

/* PO numbers come from a single UPDATE … RETURNING on the settings row so two
   concurrent submits can never collide (never max()+1). */
async function nextPoNumber(tx: Tx) {
  const [row] = await tx
    .update(companySettings)
    .set({ nextPoSeq: sql`${companySettings.nextPoSeq} + 1` })
    .where(eq(companySettings.id, 1))
    .returning({ seq: companySettings.nextPoSeq, prefix: companySettings.poPrefix });
  if (!row) throw new PoError("Company settings missing");
  return `${row.prefix}-${new Date().getFullYear()}-${String(row.seq - 1).padStart(4, "0")}`;
}

function normaliseLines(lines: PoLineInput[]) {
  const clean = lines
    .filter((l) => l.description.trim() && l.qty > 0)
    .map((l, i) => ({ lineNo: i + 1, skuId: l.skuId || null, description: l.description.trim(), qty: Math.round(l.qty), unitCost: Math.round(l.unitCost * 100) / 100 }));
  if (clean.length === 0) throw new PoError("Add at least one line with a quantity.");
  return clean;
}

export async function createPo(input: PoInput, actor: Actor, requesterId: string | null) {
  const db = getDb();
  const lines = normaliseLines(input.lines);
  const totals = poTotals(lines, 0);
  const po = await db.transaction(async (tx) => {
    const poNumber = await nextPoNumber(tx);
    const [po] = await tx
      .insert(purchaseOrders)
      .values({
        poNumber,
        status: "draft",
        source: input.source ?? "manual",
        vendorId: input.vendorId,
        warehouseId: input.warehouseId,
        requesterId,
        currency: input.currency ?? "USD",
        ...totals,
        notes: input.notes ?? "",
        neededBy: input.neededBy || null,
      })
      .returning();
    await tx.insert(purchaseOrderLines).values(lines.map((l) => ({ poId: po.id, ...l, lineTotal: lineTotal(l.qty, l.unitCost) })));
    await recordPoEvent({ poId: po.id, type: "created", actor, message: `Draft created (${input.source ?? "manual"})` }, tx);
    await audit({ actor, action: "po.create", entityType: "purchase_order", entityId: po.id, payload: { poNumber, total: totals.total } }, tx);
    return po;
  });
  await emit("po.created", { poId: po.id, poNumber: po.poNumber, total: po.total, vendorId: po.vendorId });
  return po;
}

export async function updatePo(id: string, input: PoInput, actor: Actor) {
  const db = getDb();
  const lines = normaliseLines(input.lines);
  const totals = poTotals(lines, 0);
  return db.transaction(async (tx) => {
    const existing = await tx.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, id) });
    if (!existing) throw new PoError("Purchase order not found");
    if (!EDITABLE_STATUSES.includes(existing.status)) throw new PoError(`A ${existing.status.replace("_", " ")} purchase order cannot be edited.`);
    const [po] = await tx
      .update(purchaseOrders)
      .set({ vendorId: input.vendorId, warehouseId: input.warehouseId, notes: input.notes ?? "", neededBy: input.neededBy || null, ...totals, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))
      .returning();
    await tx.delete(purchaseOrderLines).where(eq(purchaseOrderLines.poId, id));
    await tx.insert(purchaseOrderLines).values(lines.map((l) => ({ poId: id, ...l, lineTotal: lineTotal(l.qty, l.unitCost) })));
    await recordPoEvent({ poId: id, type: "edited", actor, message: `Lines updated · ${money(totals.total)}` }, tx);
    await audit({ actor, action: "po.update", entityType: "purchase_order", entityId: id, payload: { total: totals.total } }, tx);
    return po;
  });
}

async function applyTransition(tx: Tx, id: string, action: PoAction, role: User["role"], extra: Partial<typeof purchaseOrders.$inferInsert> = {}) {
  const [locked] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for("update");
  if (!locked) throw new PoError("Purchase order not found");
  if (!ACTION_ROLES[action].includes(role)) throw new PoError(`Your role cannot ${action} a purchase order.`);
  const next = transition(locked.status, action);
  if (!next) throw new PoError(`Cannot ${action} a purchase order that is ${locked.status.replace("_", " ")}.`);
  const [po] = await tx.update(purchaseOrders).set({ status: next, updatedAt: new Date(), ...extra }).where(eq(purchaseOrders.id, id)).returning();
  return { before: locked, po };
}

export async function submitPo(id: string, user: User) {
  const db = getDb();
  const actor = userActor(user);
  const settings = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  const { po, detail } = await db.transaction(async (tx) => {
    const { po } = await applyTransition(tx, id, "submit", user.role, { submittedAt: new Date() });
    await recordPoEvent({ poId: id, type: "submitted", actor, message: "Submitted for approval" }, tx);
    await audit({ actor, action: "po.submit", entityType: "purchase_order", entityId: id, payload: { poNumber: po.poNumber } }, tx);
    const detail = (await getPo(id))!;
    return { po, detail };
  });

  // Auto-approval under the configured threshold (off when threshold is 0).
  if (settings && settings.approvalThreshold > 0 && po.total <= settings.approvalThreshold) {
    await decidePo(id, "approve", { actor: { type: "system", label: "Auto-approval" }, role: "admin", note: `Under approval threshold ${money(settings.approvalThreshold)}`, approverId: null });
    return getPo(id);
  }

  // Asana task, best effort
  if (await asanaEnabled()) {
    try {
      const task = await createAsanaTask({
        name: `Approve ${po.poNumber} · ${detail.vendor.name} · ${money(po.total)}`,
        notes: `${detail.requester?.name ?? "Requester"} submitted ${po.poNumber} for ${detail.warehouse.name}.\n\n${detail.lines.map((l) => `• ${l.qty} × ${l.description} — ${money(l.lineTotal)}`).join("\n")}\n\nOpen: ${appUrl(`/purchase-orders/${po.id}`)}`,
        dueOn: po.neededBy,
      });
      if (task) {
        await db.update(purchaseOrders).set({ asanaTaskGid: task.gid }).where(eq(purchaseOrders.id, id));
        await recordPoEvent({ poId: id, type: "asana_task_created", actor: { type: "system", label: "Asana" }, message: `Asana task created`, meta: { gid: task.gid, url: task.permalink_url } });
      }
    } catch (err) {
      await recordPoEvent({ poId: id, type: "asana_failed", actor: { type: "system", label: "Asana" }, message: err instanceof Error ? err.message : "Asana call failed" });
    }
  }

  // Signed one-time links, one pair per approver
  const approvers = await db.select().from(users).where(and(inArray(users.role, ["manager", "admin"]), eq(users.isActive, true), eq(users.isServiceAccount, false)));
  const ttl = APPROVAL_TOKEN_TTL_HOURS * 3_600_000;
  for (const a of approvers) {
    const approveRaw = await issueToken("po_approve", { userId: a.id, poId: id, ttlMs: ttl });
    const rejectRaw = await issueToken("po_reject", { userId: a.id, poId: id, ttlMs: ttl });
    const mail = approvalRequestEmail({
      poNumber: po.poNumber,
      requester: detail.requester?.name ?? user.name,
      vendor: detail.vendor.name,
      total: money(po.total),
      neededBy: po.neededBy,
      lines: detail.lines.map((l) => ({ description: l.description, qty: l.qty, lineTotal: money(l.lineTotal) })),
      approveUrl: appUrl(`/approvals/${approveRaw}`),
      rejectUrl: appUrl(`/approvals/${rejectRaw}`),
      viewUrl: appUrl(`/purchase-orders/${po.id}`),
    });
    await sendEmail({ to: a.email, ...mail });
  }
  await recordPoEvent({ poId: id, type: "approval_email_sent", actor: { type: "system", label: "System" }, message: `Approval request emailed to ${approvers.map((a) => a.name).join(", ") || "no approvers"}` });
  await emit("po.submitted", { poId: po.id, poNumber: po.poNumber, total: po.total, vendor: detail.vendor.name, requester: detail.requester?.name });
  return getPo(id);
}

export async function decidePo(
  id: string,
  action: "approve" | "reject",
  opts: { actor: Actor; role: User["role"]; note?: string; approverId: string | null; via?: "app" | "email" | "api" | "asana" },
) {
  const db = getDb();
  const po = await db.transaction(async (tx) => {
    const { po } = await applyTransition(tx, id, action, opts.role, {
      decidedAt: new Date(),
      decisionNote: opts.note ?? "",
      approverId: opts.approverId,
    });
    await voidPoTokens(id, tx);
    await recordPoEvent(
      { poId: id, type: action === "approve" ? "approved" : "rejected", actor: opts.actor, message: `${action === "approve" ? "Approved" : "Rejected"} via ${opts.via ?? "app"}${opts.note ? ` — ${opts.note}` : ""}` },
      tx,
    );
    await audit({ actor: opts.actor, action: `po.${action}`, entityType: "purchase_order", entityId: id, payload: { poNumber: po.poNumber, via: opts.via ?? "app" } }, tx);
    return po;
  });

  if (po.asanaTaskGid) {
    try {
      await completeAsanaTask(po.asanaTaskGid, `${action === "approve" ? "Approved" : "Rejected"} by ${opts.actor.label}${opts.note ? `: ${opts.note}` : ""}`);
      await recordPoEvent({ poId: id, type: "asana_task_completed", actor: { type: "system", label: "Asana" }, message: "Asana task completed" });
    } catch (err) {
      await recordPoEvent({ poId: id, type: "asana_failed", actor: { type: "system", label: "Asana" }, message: err instanceof Error ? err.message : "Asana call failed" });
    }
  }
  if (po.requesterId) {
    const requester = await db.query.users.findFirst({ where: eq(users.id, po.requesterId) });
    if (requester) {
      const mail = decisionEmail({ poNumber: po.poNumber, decision: action === "approve" ? "approved" : "rejected", approver: opts.actor.label, note: opts.note ?? "", viewUrl: appUrl(`/purchase-orders/${po.id}`) });
      await sendEmail({ to: requester.email, ...mail });
    }
  }
  await emit(action === "approve" ? "po.approved" : "po.rejected", { poId: po.id, poNumber: po.poNumber, total: po.total, by: opts.actor.label, note: opts.note ?? "" });
  return po;
}

/* Email link path: the token identifies the approver; the PO status is
   re-checked inside the same transaction as the update. */
export async function decideByToken(raw: string, ip: string | null) {
  const db = getDb();
  let consumed = await consumeToken(raw, "po_approve", ip);
  let action: "approve" | "reject" = "approve";
  if (!consumed.ok) {
    consumed = await consumeToken(raw, "po_reject", ip);
    action = "reject";
  }
  if (!consumed.ok) return { ok: false as const, reason: consumed.reason };
  const token = consumed.token;
  if (!token.poId || !token.userId) return { ok: false as const, reason: "invalid" as const };
  const approver = await db.query.users.findFirst({ where: eq(users.id, token.userId) });
  if (!approver || !approver.isActive) return { ok: false as const, reason: "invalid" as const };
  try {
    const po = await decidePo(token.poId, action, { actor: { type: "token", id: approver.id, label: `${approver.name} (email link)` }, role: approver.role, approverId: approver.id, via: "email" });
    return { ok: true as const, action, po, approver };
  } catch (err) {
    return { ok: false as const, reason: "conflict" as const, message: err instanceof Error ? err.message : "Could not apply decision" };
  }
}

export async function peekApprovalToken(raw: string) {
  const { peekToken } = await import("@/server/security/tokens");
  let r = await peekToken(raw, "po_approve");
  let action: "approve" | "reject" = "approve";
  if (!r.ok) {
    r = await peekToken(raw, "po_reject");
    action = "reject";
  }
  if (!r.ok) return { ok: false as const, reason: r.reason };
  const po = r.token.poId ? await getPo(r.token.poId) : null;
  if (!po) return { ok: false as const, reason: "invalid" as const };
  return { ok: true as const, action, po };
}

export async function orderPo(id: string, user: User) {
  const db = getDb();
  const actor = userActor(user);
  const po = await db.transaction(async (tx) => {
    const { po } = await applyTransition(tx, id, "order", user.role, { orderedAt: new Date() });
    await recordPoEvent({ poId: id, type: "ordered", actor, message: "PO sent to vendor" }, tx);
    await audit({ actor, action: "po.order", entityType: "purchase_order", entityId: id }, tx);
    return po;
  });
  if (po.asanaTaskGid) await commentAsanaTask(po.asanaTaskGid, `${po.poNumber} sent to vendor by ${user.name}`).catch(() => {});
  await emit("po.ordered", { poId: po.id, poNumber: po.poNumber });
  return po;
}

/* Receiving is idempotent per line (qty_received capped at qty). Stock moves
   in the same transaction; full receipt flips the status. */
export async function receivePo(id: string, received: { lineId: string; qty: number }[], user: User) {
  const db = getDb();
  const actor = userActor(user);
  const result = await db.transaction(async (tx) => {
    const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).for("update");
    if (!po) throw new PoError("Purchase order not found");
    if (po.status !== "ordered") throw new PoError("Only ordered purchase orders can receive goods.");
    if (!ACTION_ROLES.receive.includes(user.role)) throw new PoError("Your role cannot receive goods.");
    const lines = await tx.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.poId, id));
    let receivedUnits = 0;
    for (const r of received) {
      const line = lines.find((l) => l.id === r.lineId);
      if (!line || r.qty <= 0) continue;
      const room = line.qty - line.qtyReceived;
      const take = Math.min(room, Math.round(r.qty));
      if (take <= 0) continue;
      await tx.update(purchaseOrderLines).set({ qtyReceived: line.qtyReceived + take }).where(eq(purchaseOrderLines.id, line.id));
      if (line.skuId) {
        await adjustStock({ skuId: line.skuId, warehouseId: po.warehouseId, delta: take, reason: "receipt", poId: id, note: `Goods receipt ${po.poNumber}` }, actor, tx);
      }
      line.qtyReceived += take;
      receivedUnits += take;
    }
    const complete = lines.every((l) => l.qtyReceived >= l.qty);
    if (complete) {
      await tx.update(purchaseOrders).set({ status: "received", receivedAt: new Date(), updatedAt: new Date() }).where(eq(purchaseOrders.id, id));
    }
    await recordPoEvent({ poId: id, type: complete ? "received" : "received_partial", actor, message: complete ? `All lines received into ${po.warehouseId === po.warehouseId ? "the depot" : ""}`.trim() : `${receivedUnits} units received (partial)` }, tx);
    await audit({ actor, action: "po.receive", entityType: "purchase_order", entityId: id, payload: { receivedUnits, complete } }, tx);
    return { complete, receivedUnits, po };
  });
  if (result.complete) await emit("po.received", { poId: id, poNumber: result.po.poNumber });
  return result;
}

export async function closePo(id: string, user: User) {
  const db = getDb();
  const actor = userActor(user);
  const po = await db.transaction(async (tx) => {
    const { po } = await applyTransition(tx, id, "close", user.role, { closedAt: new Date() });
    await recordPoEvent({ poId: id, type: "closed", actor, message: "Closed" }, tx);
    await audit({ actor, action: "po.close", entityType: "purchase_order", entityId: id }, tx);
    return po;
  });
  await emit("po.closed", { poId: po.id, poNumber: po.poNumber });
  return po;
}

export async function cancelPo(id: string, user: User, note = "") {
  const db = getDb();
  const actor = userActor(user);
  return db.transaction(async (tx) => {
    const { before, po } = await applyTransition(tx, id, "cancel", user.role, { decisionNote: note });
    if (user.role === "requester" && before.requesterId !== user.id) throw new PoError("You can only cancel your own purchase orders.");
    await voidPoTokens(id, tx);
    await recordPoEvent({ poId: id, type: "cancelled", actor, message: note || "Cancelled" }, tx);
    await audit({ actor, action: "po.cancel", entityType: "purchase_order", entityId: id }, tx);
    return po;
  });
}

export async function reopenPo(id: string, user: User) {
  const db = getDb();
  const actor = userActor(user);
  return db.transaction(async (tx) => {
    const { po } = await applyTransition(tx, id, "reopen", user.role, { decidedAt: null, decisionNote: "", approverId: null, submittedAt: null });
    await recordPoEvent({ poId: id, type: "reopened", actor, message: "Reopened as draft" }, tx);
    return po;
  });
}

export async function poStageCounts() {
  const rows = await getDb().select({ status: purchaseOrders.status, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${purchaseOrders.total}),0)` }).from(purchaseOrders).groupBy(purchaseOrders.status);
  const out: Record<string, { n: number; value: number }> = {};
  for (const r of rows) out[r.status] = { n: Number(r.n), value: Number(r.value) };
  return out;
}

export async function invoiceStageCounts() {
  const rows = await getDb().select({ status: invoices.status, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${invoices.total}),0)` }).from(invoices).groupBy(invoices.status);
  const out: Record<string, { n: number; value: number }> = {};
  for (const r of rows) out[r.status] = { n: Number(r.n), value: Number(r.value) };
  return out;
}
