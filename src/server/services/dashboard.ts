import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, poEvents, purchaseOrders, skus, stockLevels, warehouses } from "@/db/schema";
import { INVOICE_STATUSES, PO_STATUSES } from "@/lib/constants";
import { lowStockList } from "./sku";

const OPEN = ["pending_approval", "approved", "ordered"] as const;

export async function dashboardData() {
  const db = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const in7 = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);

  const [openRow] = await db
    .select({ n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${purchaseOrders.total}),0)` })
    .from(purchaseOrders)
    .where(inArray(purchaseOrders.status, [...OPEN]));
  const [pendingRow] = await db.select({ n: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.status, "pending_approval"));
  const [mtdRow] = await db
    .select({ value: sql<number>`coalesce(sum(${purchaseOrders.total}),0)`, n: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(and(inArray(purchaseOrders.status, ["approved", "ordered", "received", "closed"]), gte(purchaseOrders.decidedAt, monthStart)));
  const [dueRow] = await db
    .select({ n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${invoices.total}),0)` })
    .from(invoices)
    .where(and(inArray(invoices.status, ["received", "matched", "approved"]), lte(invoices.dueAt, in7)));
  const [overdueRow] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(inArray(invoices.status, ["received", "matched", "approved"]), lte(invoices.dueAt, now.toISOString().slice(0, 10))));

  const low = await lowStockList();

  // Spend by month, last 6 months (by creation month, excluding drafts/cancelled/rejected)
  const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const spendRows = await db
    .select({ month: sql<string>`to_char(date_trunc('month', ${purchaseOrders.createdAt}), 'YYYY-MM')`, value: sql<number>`sum(${purchaseOrders.total})`, n: sql<number>`count(*)` })
    .from(purchaseOrders)
    .where(and(gte(purchaseOrders.createdAt, sixAgo), inArray(purchaseOrders.status, ["pending_approval", "approved", "ordered", "received", "closed"])))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const spendByMonth: { month: string; label: string; value: number; n: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = spendRows.find((r) => r.month === key);
    spendByMonth.push({ month: key, label: d.toLocaleString("en", { month: "short" }), value: Number(row?.value ?? 0), n: Number(row?.n ?? 0) });
  }

  const stockRows = await db
    .select({
      code: warehouses.code,
      name: warehouses.name,
      units: sql<number>`coalesce(sum(${stockLevels.qty}),0)`,
      value: sql<number>`coalesce(sum(${stockLevels.qty} * ${skus.unitCost}),0)`,
    })
    .from(warehouses)
    .leftJoin(stockLevels, eq(stockLevels.warehouseId, warehouses.id))
    .leftJoin(skus, eq(skus.id, stockLevels.skuId))
    .groupBy(warehouses.id)
    .orderBy(warehouses.code);

  const invRows = await db.select({ status: invoices.status, n: sql<number>`count(*)`, value: sql<number>`coalesce(sum(${invoices.total}),0)` }).from(invoices).groupBy(invoices.status);
  const invoicesByStatus = INVOICE_STATUSES.map((s) => {
    const r = invRows.find((x) => x.status === s);
    return { status: s, n: Number(r?.n ?? 0), value: Number(r?.value ?? 0) };
  });

  const poRows = await db.select({ status: purchaseOrders.status, n: sql<number>`count(*)` }).from(purchaseOrders).groupBy(purchaseOrders.status);
  const posByStatus = PO_STATUSES.map((s) => ({ status: s, n: Number(poRows.find((x) => x.status === s)?.n ?? 0) }));

  const activity = await db
    .select({
      id: poEvents.id,
      type: poEvents.type,
      message: poEvents.message,
      actorLabel: poEvents.actorLabel,
      createdAt: poEvents.createdAt,
      poId: poEvents.poId,
      poNumber: purchaseOrders.poNumber,
    })
    .from(poEvents)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, poEvents.poId))
    .orderBy(desc(poEvents.createdAt))
    .limit(10);

  return {
    kpis: {
      openPos: { n: Number(openRow.n), value: Number(openRow.value) },
      pendingApprovals: Number(pendingRow.n),
      spendMtd: { value: Number(mtdRow.value), n: Number(mtdRow.n) },
      invoicesDue: { n: Number(dueRow.n), value: Number(dueRow.value), overdue: Number(overdueRow.n) },
      lowStock: { n: low.length, outOfStock: low.filter((l) => l.qty <= 0).length },
    },
    spendByMonth,
    stockByWarehouse: stockRows.map((r) => ({ ...r, units: Number(r.units), value: Number(r.value) })),
    invoicesByStatus,
    posByStatus,
    lowStock: low.slice(0, 8),
    activity,
  };
}
