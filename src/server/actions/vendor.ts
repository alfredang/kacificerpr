"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction } from "@/server/auth/session";
import { upsertVendor } from "@/server/services/vendor";
import { userActor } from "@/server/services/po";
import type { ActionResult } from "./po";

const schema = z.object({
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9-]+$/i, "Code: letters, digits, dashes"),
  name: z.string().trim().min(2).max(120),
  contactName: z.string().trim().max(120).default(""),
  email: z.string().trim().email().max(200).or(z.literal("")).default(""),
  phone: z.string().trim().max(40).default(""),
  country: z.string().trim().max(60).default(""),
  leadTimeDays: z.coerce.number().int().min(0).max(365).default(14),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(30),
  currency: z.string().trim().length(3).default("USD"),
  rating: z.coerce.number().int().min(1).max(5).default(3),
  notes: z.string().trim().max(2000).default(""),
  isActive: z.coerce.boolean().default(true),
});

export async function saveVendorAction(id: string | null, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("vendor.manage");
  const raw = Object.fromEntries(formData);
  const parsed = schema.safeParse({ ...raw, isActive: raw.isActive === "on" || raw.isActive === "true" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the vendor details." };
  let vendorId: string;
  try {
    const row = await upsertVendor({ ...parsed.data, code: parsed.data.code.toUpperCase() }, userActor(user), id ?? undefined);
    vendorId = row.id;
  } catch (err) {
    if (err instanceof Error && /vendors_code_unique/.test(err.message)) return { error: "That vendor code is already in use." };
    throw err;
  }
  revalidatePath("/vendors");
  redirect(`/vendors/${vendorId}`);
}
