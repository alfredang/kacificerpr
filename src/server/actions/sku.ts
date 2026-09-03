"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction } from "@/server/auth/session";
import { adjustStock, upsertSku } from "@/server/services/sku";
import { userActor } from "@/server/services/po";
import type { ActionResult } from "./po";

const skuSchema = z.object({
  sku: z.string().trim().min(2).max(30).regex(/^[A-Z0-9-]+$/i, "SKU: letters, digits, dashes"),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(1).max(40),
  unit: z.string().trim().min(1).max(12).default("ea"),
  unitCost: z.coerce.number().nonnegative().max(10_000_000),
  reorderLevel: z.coerce.number().int().min(0),
  reorderQty: z.coerce.number().int().min(0),
  preferredVendorId: z.string().uuid().nullable().or(z.literal("")),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(14),
  isActive: z.coerce.boolean().default(true),
});

export async function saveSkuAction(id: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("sku.manage");
  const raw = Object.fromEntries(formData);
  const parsed = skuSchema.safeParse({ ...raw, isActive: raw.isActive === "on" || raw.isActive === "true" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the SKU details." };
  let code: string;
  try {
    const row = await upsertSku({ ...parsed.data, sku: parsed.data.sku.toUpperCase(), preferredVendorId: parsed.data.preferredVendorId || null }, userActor(user), id ?? undefined);
    code = row.sku;
  } catch (err) {
    if (err instanceof Error && /skus_sku_unique/.test(err.message)) return { error: "That SKU code already exists." };
    throw err;
  }
  revalidatePath("/skus");
  redirect(`/skus/${code}`);
}

const adjustSchema = z.object({
  skuId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  delta: z.coerce.number().int().refine((n) => n !== 0, "Enter a non-zero quantity"),
  reason: z.enum(["adjustment", "issue", "transfer", "receipt"]),
  note: z.string().trim().max(300).default(""),
});

export async function adjustStockAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("stock.adjust");
  const parsed = adjustSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the adjustment." };
  await adjustStock(parsed.data, userActor(user));
  revalidatePath("/skus");
  revalidatePath("/low-stock");
  revalidatePath("/dashboard");
  return { ok: true };
}
