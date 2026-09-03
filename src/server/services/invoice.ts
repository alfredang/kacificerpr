import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getDb } from "@/db";
import { companySettings, invoiceLines, invoices, purchaseOrders, type Invoice, type User } from "@/db/schema";
import type { InvoiceStatus } from "@/lib/constants";
import { lineTotal, poTotals } from "@/lib/po-status";
import { emit, recordPoEvent } from "@/server/events";
import { audit, type Actor } from "./audit";

export class InvoiceError extends Error {}

export async function listInvoices(opts: { status?: InvoiceStatus; q?: string; vendorId?: string; poId?: string } = {}) {
  const db = getDb();
  const where = [];
  if (opts.status) where.push(eq(invoices.status, opts.status));
  if (opts.vendorId) where.push(eq(invoices.vendorId, opts.vendorId));
  if (opts.poId) where.push(eq(invoices.poId, opts.poId));
  if (opts.q) where.push(or(ilike(invoices.invoiceNumber, `%${opts.q}%`), ilike(invoices.notes, `%${opts.q}%`)));
  return db.query.invoices.findMany({
    where: where.length ? and(...where) : undefined,
    with: { vendor: true, po: { columns: { id: true, poNumber: true, status: true, total: true } } },
    orderBy: [desc(invoices.createdAt)],
    limit: 200,
  });
}

export async function getInvoice(id: string) {
  return getDb().query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      vendor: true,
      lines: { with: { sku: true } },
      po: { with: { lines: { with: { sku: true } }, warehouse: true } },
    },
  });
}
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;

export type InvoiceInput = {
  invoiceNumber: string;
  vendorId: string;
  poId?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  notes?: string;
  lines: { skuId?: string | null; description: string; qty: number; unitCost: number }[];
};

export async function createInvoice(input: InvoiceInput, actor: Actor, createdBy: string | null) {
  const db = getDb();
  const lines = input.lines.filter((l) => l.description.trim() && l.qty > 0).map((l) => ({ skuId: l.skuId || null, description: l.description.trim(), qty: Math.round(l.qty), unitCost: Math.round(l.unitCost * 100) / 100 }));
  if (lines.length === 0) throw new InvoiceError("Add at least one line.");
  if (input.poId) {
    const po = await db.query.purchaseOrders.findFirst({ where: eq(purchaseOrders.id, input.poId) });
    if (!po) throw new InvoiceError("Purchase order not found");
    if (po.vendorId !== input.vendorId) throw new InvoiceError("The invoice vendor must match the purchase order vendor.");
  }
  const totals = poTotals(lines, 0);
  const inv = await db.transaction(async (tx) => {
    const [inv] = await tx
      .insert(invoices)
      .values({
        invoiceNumber: input.invoiceNumber.trim(),
        vendorId: input.vendorId,
        poId: input.poId || null,
        status: "received",
        ...totals,
        issuedAt: input.issuedAt || null,
        dueAt: input.dueAt || null,
        receivedAt: new Date(),
        notes: input.notes ?? "",
        createdBy,
      })
      .returning();
    await tx.insert(invoiceLines).values(lines.map((l) => ({ invoiceId: inv.id, ...l, lineTotal: lineTotal(l.qty, l.unitCost) })));
    if (inv.poId) await recordPoEvent({ poId: inv.poId, type: "invoice_linked", actor, message: `Invoice ${inv.invoiceNumber} linked · ${totals.total.toFixed(2)}` }, tx);
    await audit({ actor, action: "invoice.create", entityType: "invoice", entityId: inv.id, payload: { invoiceNumber: inv.invoiceNumber, total: totals.total } }, tx);
    return inv;
  });
  await emit("invoice.received", { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, total: inv.total, poId: inv.poId });
  if (inv.poId) await runMatch(inv.id, actor);
  return inv;
}

/* Three-way match: PO exists and vendor matches; invoiced qty ≤ ordered qty
   per SKU; invoiced qty ≤ received qty per SKU (goods receipt); unit price
   within the tolerance from company settings. All four pass → matched. */
export async function computeMatch(inv: NonNullable<Awaited<ReturnType<typeof getInvoice>>>, tolerancePct: number) {
  const notes: string[] = [];
  const po = inv.po;
  const poMatch = Boolean(po && po.vendorId === inv.vendorId);
  if (!po) notes.push("No purchase order linked.");
  else if (po.vendorId !== inv.vendorId) notes.push("Vendor differs from the purchase order.");
  let qtyMatch = poMatch;
  let receiptMatch = poMatch;
  let priceMatch = poMatch;
  if (po) {
    const bySku = new Map<string, { qty: number; received: number; unitCost: number; description: string }>();
    for (const l of po.lines) {
      const key = l.skuId ?? l.description;
      const cur = bySku.get(key) ?? { qty: 0, received: 0, unitCost: l.unitCost, description: l.description };
      cur.qty += l.qty;
      cur.received += l.qtyReceived;
      bySku.set(key, cur);
    }
    for (const l of inv.lines) {
      const key = l.skuId ?? l.description;
      const p = bySku.get(key);
      if (!p) {
        qtyMatch = false;
        notes.push(`“${l.description}” is not on the purchase order.`);
        continue;
      }
      if (l.qty > p.qty) {
        qtyMatch = false;
        notes.push(`${l.description}: invoiced ${l.qty}, ordered ${p.qty}.`);
      }
      if (l.qty > p.received) {
        receiptMatch = false;
        notes.push(`${l.description}: invoiced ${l.qty}, received ${p.received}.`);
      }
      const diffPct = p.unitCost === 0 ? 0 : (Math.abs(l.unitCost - p.unitCost) / p.unitCost) * 100;
      if (diffPct > tolerancePct) {
        priceMatch = false;
        notes.push(`${l.description}: unit price ${l.unitCost.toFixed(2)} vs PO ${p.unitCost.toFixed(2)} (${diffPct.toFixed(1)}%).`);
      }
    }
  }
  const variance = po ? Math.round((inv.total - po.total) * 100) / 100 : inv.total;
  return { poMatch, qtyMatch, receiptMatch, priceMatch, variance, notes, checkedAt: new Date().toISOString() };
}

export async function runMatch(id: string, actor: Actor) {
  const db = getDb();
  const inv = await getInvoice(id);
  if (!inv) throw new InvoiceError("Invoice not found");
  const settings = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  const match = await computeMatch(inv, settings?.priceTolerancePct ?? 2);
  const all = match.poMatch && match.qtyMatch && match.receiptMatch && match.priceMatch;
  const nextStatus: Invoice["status"] = inv.status === "received" || inv.status === "matched" ? (all ? "matched" : "received") : inv.status;
  await db
    .update(invoices)
    .set({ match, status: nextStatus, matchedAt: all ? (inv.matchedAt ?? new Date()) : null, updatedAt: new Date() })
    .where(eq(invoices.id, id));
  await audit({ actor, action: "invoice.match", entityType: "invoice", entityId: id, payload: { all, notes: match.notes } });
  if (all && inv.status !== "matched") await emit("invoice.matched", { invoiceId: id, invoiceNumber: inv.invoiceNumber, total: inv.total });
  return { match, all };
}

const INVOICE_FLOW: Record<string, { from: Invoice["status"][]; to: Invoice["status"]; roles: User["role"][] }> = {
  approve: { from: ["matched", "received"], to: "approved", roles: ["admin", "finance", "manager"] },
  pay: { from: ["approved"], to: "paid", roles: ["admin", "finance"] },
  dispute: { from: ["received", "matched", "approved"], to: "disputed", roles: ["admin", "finance", "procurement"] },
  reopen: { from: ["disputed"], to: "received", roles: ["admin", "finance", "procurement"] },
};

export async function moveInvoice(id: string, action: keyof typeof INVOICE_FLOW, user: User, note = "") {
  const rule = INVOICE_FLOW[action];
  if (!rule.roles.includes(user.role)) throw new InvoiceError(`Your role cannot ${action} an invoice.`);
  const db = getDb();
  const actor: Actor = { type: "user", id: user.id, label: user.name };
  const inv = await db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
    if (!inv) throw new InvoiceError("Invoice not found");
    if (!rule.from.includes(inv.status)) throw new InvoiceError(`Cannot ${action} an invoice that is ${inv.status}.`);
    const [row] = await tx
      .update(invoices)
      .set({ status: rule.to, paidAt: rule.to === "paid" ? new Date() : inv.paidAt, notes: note ? `${inv.notes ? inv.notes + "\n" : ""}${note}` : inv.notes, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    if (row.poId) await recordPoEvent({ poId: row.poId, type: `invoice_${rule.to}`, actor, message: `Invoice ${row.invoiceNumber} ${rule.to}${note ? ` — ${note}` : ""}` }, tx);
    await audit({ actor, action: `invoice.${action}`, entityType: "invoice", entityId: id, payload: { note } }, tx);
    return row;
  });
  if (rule.to === "paid") await emit("invoice.paid", { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, total: inv.total });
  return inv;
}

export async function overdueInvoices() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await listInvoices();
  return rows.filter((i) => ["received", "matched", "approved"].includes(i.status) && i.dueAt && i.dueAt < today);
}
