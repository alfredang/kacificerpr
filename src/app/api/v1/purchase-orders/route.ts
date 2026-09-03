import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, warehouses } from "@/db/schema";
import { withApi, ok, jsonBody, ApiError } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";
import { createPo } from "@/server/services/po";

export const dynamic = "force-dynamic";

export const GET = withApi({ scope: "read:po" }, async ({ req }) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  return ok(await runTool("list_purchase_orders", { status: q.status, limit: q.limit ? Number(q.limit) : undefined }));
});

const createSchema = z.object({
  vendorId: z.string().uuid(),
  warehouseCode: z.string().optional(),
  warehouseId: z.string().uuid().optional(),
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(z.object({ sku: z.string().optional(), skuId: z.string().uuid().optional(), description: z.string().optional(), qty: z.number().int().positive(), unitCost: z.number().nonnegative().optional() })).min(1),
});

/* Creates a DRAFT. Submitting (which emails managers) is a separate call so an
   agent can let a human review the draft first. */
export const POST = withApi({ scope: "write:po", action: "po.create" }, async ({ req, principal, onBehalfOf }) => {
  const body = await jsonBody(req, createSchema);
  const db = getDb();
  let warehouseId = body.warehouseId;
  if (!warehouseId) {
    const wh = await db.query.warehouses.findFirst({ where: eq(warehouses.code, body.warehouseCode ?? "SIN-HQ") });
    if (!wh) throw new ApiError(422, "Unknown warehouse code", "validation");
    warehouseId = wh.id;
  }
  const lines = [];
  for (const l of body.lines) {
    let sku = null;
    if (l.skuId) sku = await db.query.skus.findFirst({ where: (s, { eq }) => eq(s.id, l.skuId!) });
    else if (l.sku) sku = await db.query.skus.findFirst({ where: (s, { eq }) => eq(s.sku, l.sku!.toUpperCase()) });
    if (!sku && !l.description) throw new ApiError(422, `Line needs a known sku or a description`, "validation");
    lines.push({ skuId: sku?.id ?? null, description: l.description ?? sku!.name, qty: l.qty, unitCost: l.unitCost ?? sku?.unitCost ?? 0 });
  }
  let requesterId: string | null = principal.user.id;
  if (onBehalfOf) {
    const human = await db.query.users.findFirst({ where: eq(users.email, onBehalfOf.toLowerCase()) });
    if (human) requesterId = human.id;
  }
  const po = await createPo({ vendorId: body.vendorId, warehouseId, neededBy: body.neededBy ?? null, notes: body.notes ?? "", source: "api", lines }, { type: "api_key", id: principal.keyId, label: `API key ${principal.name}${onBehalfOf ? ` for ${onBehalfOf}` : ""}` }, requesterId);
  return ok(await runTool("get_purchase_order", { idOrNumber: po.id }), {}, 201);
});
