import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, purchaseOrders, skus, vendors } from "@/db/schema";
import type { Actor } from "./audit";
import { audit } from "./audit";

export async function listVendors(opts: { q?: string; includeInactive?: boolean } = {}) {
  const db = getDb();
  const where = [];
  if (!opts.includeInactive) where.push(eq(vendors.isActive, true));
  if (opts.q) where.push(or(ilike(vendors.name, `%${opts.q}%`), ilike(vendors.code, `%${opts.q}%`), ilike(vendors.country, `%${opts.q}%`)));
  const rows = await db.select().from(vendors).where(where.length ? and(...where) : undefined).orderBy(asc(vendors.name));
  const stats = await db
    .select({ vendorId: purchaseOrders.vendorId, n: sql<number>`count(*)`, spend: sql<number>`coalesce(sum(${purchaseOrders.total}) filter (where ${purchaseOrders.status} in ('approved','ordered','received','closed')),0)`, open: sql<number>`count(*) filter (where ${purchaseOrders.status} in ('pending_approval','approved','ordered'))` })
    .from(purchaseOrders)
    .groupBy(purchaseOrders.vendorId);
  const skuCounts = await db.select({ vendorId: skus.preferredVendorId, n: sql<number>`count(*)` }).from(skus).groupBy(skus.preferredVendorId);
  return rows.map((v) => {
    const st = stats.find((s) => s.vendorId === v.id);
    return { ...v, poCount: Number(st?.n ?? 0), spend: Number(st?.spend ?? 0), openPos: Number(st?.open ?? 0), skuCount: Number(skuCounts.find((s) => s.vendorId === v.id)?.n ?? 0) };
  });
}

export async function getVendor(id: string) {
  const db = getDb();
  const vendor = await db.query.vendors.findFirst({ where: eq(vendors.id, id) });
  if (!vendor) return null;
  const pos = await db.query.purchaseOrders.findMany({ where: eq(purchaseOrders.vendorId, id), orderBy: [desc(purchaseOrders.createdAt)], limit: 20, with: { warehouse: true } });
  const invs = await db.query.invoices.findMany({ where: eq(invoices.vendorId, id), orderBy: [desc(invoices.createdAt)], limit: 20 });
  const vendorSkus = await db.select().from(skus).where(eq(skus.preferredVendorId, id)).orderBy(asc(skus.sku));
  const spend = pos.filter((p) => ["approved", "ordered", "received", "closed"].includes(p.status)).reduce((s, p) => s + p.total, 0);
  const disputed = invs.filter((i) => i.status === "disputed").length;
  return { ...vendor, pos, invoices: invs, skus: vendorSkus, spend, disputed };
}

export type VendorInput = Omit<typeof vendors.$inferInsert, "id" | "createdAt" | "updatedAt">;

export async function upsertVendor(input: VendorInput, actor: Actor, id?: string) {
  const db = getDb();
  if (id) {
    const [row] = await db.update(vendors).set({ ...input, updatedAt: new Date() }).where(eq(vendors.id, id)).returning();
    await audit({ actor, action: "vendor.update", entityType: "vendor", entityId: id, payload: { code: input.code } });
    return row;
  }
  const [row] = await db.insert(vendors).values(input).returning();
  await audit({ actor, action: "vendor.create", entityType: "vendor", entityId: row.id, payload: { code: input.code } });
  return row;
}
