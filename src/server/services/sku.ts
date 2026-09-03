import { and, asc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { purchaseOrderLines, purchaseOrders, skus, stockLevels, stockMovements, vendors, warehouses } from "@/db/schema";
import type { Actor } from "./audit";
import { audit } from "./audit";

export async function listWarehouses() {
  return getDb().select().from(warehouses).where(eq(warehouses.isActive, true)).orderBy(asc(warehouses.code));
}

export async function listSkus(opts: { q?: string; category?: string; includeInactive?: boolean } = {}) {
  const db = getDb();
  const where = [];
  if (!opts.includeInactive) where.push(eq(skus.isActive, true));
  if (opts.q) where.push(or(ilike(skus.sku, `%${opts.q}%`), ilike(skus.name, `%${opts.q}%`)));
  if (opts.category) where.push(eq(skus.category, opts.category));
  const rows = await db.query.skus.findMany({
    where: where.length ? and(...where) : undefined,
    with: { preferredVendor: true, stock: true },
    orderBy: [asc(skus.sku)],
  });
  const onOrder = await onOrderBySku();
  return rows.map((r) => {
    const qty = r.stock.reduce((s, l) => s + l.qty, 0);
    return { ...r, qty, onOrder: onOrder[r.id] ?? 0 };
  });
}

export async function getSku(idOrSku: string) {
  const db = getDb();
  const row = await db.query.skus.findFirst({
    where: or(eq(skus.sku, idOrSku), sql`${skus.id}::text = ${idOrSku}`),
    with: { preferredVendor: true, stock: { with: { warehouse: true } } },
  });
  if (!row) return null;
  const movements = await db.query.stockMovements.findMany({
    where: eq(stockMovements.skuId, row.id),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    limit: 25,
  });
  const whs = await listWarehouses();
  const openLines = await db
    .select({ poId: purchaseOrders.id, poNumber: purchaseOrders.poNumber, status: purchaseOrders.status, qty: purchaseOrderLines.qty, received: purchaseOrderLines.qtyReceived })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.poId))
    .where(and(eq(purchaseOrderLines.skuId, row.id), inArray(purchaseOrders.status, ["pending_approval", "approved", "ordered"])));
  const qty = row.stock.reduce((s, l) => s + l.qty, 0);
  const onOrder = openLines.reduce((s, l) => s + Math.max(0, l.qty - l.received), 0);
  return { ...row, qty, onOrder, movements, warehouses: whs, openLines };
}

/* Units on open POs (approved/ordered/pending), net of what is already received. */
export async function onOrderBySku(): Promise<Record<string, number>> {
  const db = getDb();
  const rows = await db
    .select({ skuId: purchaseOrderLines.skuId, qty: sql<number>`sum(${purchaseOrderLines.qty} - ${purchaseOrderLines.qtyReceived})` })
    .from(purchaseOrderLines)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, purchaseOrderLines.poId))
    .where(inArray(purchaseOrders.status, ["pending_approval", "approved", "ordered"]))
    .groupBy(purchaseOrderLines.skuId);
  const out: Record<string, number> = {};
  for (const r of rows) if (r.skuId) out[r.skuId] = Number(r.qty);
  return out;
}

export type LowStockItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  qty: number;
  reorderLevel: number;
  reorderQty: number;
  onOrder: number;
  shortfall: number;
  suggestedQty: number;
  leadTimeDays: number;
  vendor: { id: string; code: string; name: string; leadTimeDays: number } | null;
  perWarehouse: { code: string; name: string; qty: number }[];
};

/* Network-level low stock: total on hand across depots below the SKU's reorder
   level. Suggested quantity covers the shortfall plus the reorder quantity,
   net of anything already on order. */
export async function lowStockList(): Promise<LowStockItem[]> {
  const db = getDb();
  const rows = await db.query.skus.findMany({
    where: eq(skus.isActive, true),
    with: { preferredVendor: true, stock: { with: { warehouse: true } } },
    orderBy: [asc(skus.sku)],
  });
  const onOrder = await onOrderBySku();
  const out: LowStockItem[] = [];
  for (const r of rows) {
    const qty = r.stock.reduce((s, l) => s + l.qty, 0);
    if (qty >= r.reorderLevel) continue;
    const ordered = onOrder[r.id] ?? 0;
    const shortfall = r.reorderLevel - qty;
    const suggestedQty = Math.max(0, shortfall + r.reorderQty - ordered);
    out.push({
      id: r.id,
      sku: r.sku,
      name: r.name,
      category: r.category,
      unit: r.unit,
      unitCost: r.unitCost,
      qty,
      reorderLevel: r.reorderLevel,
      reorderQty: r.reorderQty,
      onOrder: ordered,
      shortfall,
      suggestedQty,
      leadTimeDays: r.leadTimeDays,
      vendor: r.preferredVendor ? { id: r.preferredVendor.id, code: r.preferredVendor.code, name: r.preferredVendor.name, leadTimeDays: r.preferredVendor.leadTimeDays } : null,
      perWarehouse: r.stock.map((l) => ({ code: l.warehouse.code, name: l.warehouse.name, qty: l.qty })),
    });
  }
  // Most urgent first: out of stock, then largest relative shortfall.
  return out.sort((a, b) => (a.qty <= 0 ? -1 : 0) - (b.qty <= 0 ? -1 : 0) || b.shortfall / b.reorderLevel - a.shortfall / a.reorderLevel);
}

export type SkuInput = {
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitCost: number;
  reorderLevel: number;
  reorderQty: number;
  preferredVendorId: string | null;
  leadTimeDays: number;
  isActive: boolean;
};

export async function upsertSku(input: SkuInput, actor: Actor, id?: string) {
  const db = getDb();
  if (id) {
    const [row] = await db.update(skus).set({ ...input, updatedAt: new Date() }).where(eq(skus.id, id)).returning();
    await audit({ actor, action: "sku.update", entityType: "sku", entityId: id, payload: { sku: input.sku } });
    return row;
  }
  const [row] = await db.insert(skus).values(input).returning();
  await audit({ actor, action: "sku.create", entityType: "sku", entityId: row.id, payload: { sku: input.sku } });
  return row;
}

/* Every stock change writes a movement and updates the level in one transaction. */
export async function adjustStock(
  input: { skuId: string; warehouseId: string; delta: number; reason: "receipt" | "adjustment" | "issue" | "transfer"; note?: string; poId?: string | null },
  actor: Actor,
  tx?: Tx,
) {
  const run = async (t: Tx) => {
    await t
      .insert(stockLevels)
      .values({ skuId: input.skuId, warehouseId: input.warehouseId, qty: input.delta })
      .onConflictDoUpdate({
        target: [stockLevels.skuId, stockLevels.warehouseId],
        set: { qty: sql`${stockLevels.qty} + ${input.delta}`, updatedAt: new Date() },
      });
    await t.insert(stockMovements).values({
      skuId: input.skuId,
      warehouseId: input.warehouseId,
      delta: input.delta,
      reason: input.reason,
      poId: input.poId ?? null,
      actorType: actor.type,
      actorId: actor.id ?? null,
      note: input.note ?? "",
    });
  };
  if (tx) return run(tx);
  return getDb().transaction(run);
}

export async function listCategories() {
  const rows = await getDb().selectDistinct({ category: skus.category }).from(skus).orderBy(skus.category);
  return rows.map((r) => r.category);
}

export async function vendorsForPicker() {
  return getDb().select({ id: vendors.id, code: vendors.code, name: vendors.name }).from(vendors).where(eq(vendors.isActive, true)).orderBy(asc(vendors.name));
}
