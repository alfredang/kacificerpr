"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction, requireUser } from "@/server/auth/session";
import { createInvoice, InvoiceError, moveInvoice, runMatch } from "@/server/services/invoice";
import { userActor } from "@/server/services/po";
import type { ActionResult } from "./po";

const schema = z.object({
  invoiceNumber: z.string().trim().min(1).max(80),
  vendorId: z.string().uuid(),
  poId: z.string().uuid().optional().or(z.literal("")),
  issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
  lines: z.array(z.object({ skuId: z.string().uuid().nullable().optional(), description: z.string().trim().min(1).max(300), qty: z.coerce.number().int().positive(), unitCost: z.coerce.number().nonnegative() })).min(1),
});

function fail(err: unknown): ActionResult {
  if (err instanceof InvoiceError) return { error: err.message };
  if (err && typeof err === "object" && "digest" in err) throw err;
  if (err instanceof Error && /invoices_vendor_number_idx/.test(err.message)) return { error: "An invoice with this number already exists for this vendor." };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export async function createInvoiceAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("invoice.create");
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {}
  if (Array.isArray(lines)) lines = lines.filter((l) => l && typeof l === "object" && String((l as { description?: string }).description ?? "").trim() && Number((l as { qty?: number }).qty) > 0);
  const parsed = schema.safeParse({
    invoiceNumber: formData.get("invoiceNumber"),
    vendorId: formData.get("vendorId"),
    poId: formData.get("poId") ?? "",
    issuedAt: formData.get("issuedAt") ?? "",
    dueAt: formData.get("dueAt") ?? "",
    notes: formData.get("notes") ?? "",
    lines,
  });
  if (!parsed.success) return { error: "Check the invoice number, vendor and at least one line." };
  let id: string;
  try {
    const inv = await createInvoice({ ...parsed.data, poId: parsed.data.poId || null, issuedAt: parsed.data.issuedAt || null, dueAt: parsed.data.dueAt || null }, userActor(user), user.id);
    id = inv.id;
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/invoices");
  redirect(`/invoices/${id}`);
}

export async function invoiceTransitionAction(id: string, action: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  try {
    if (action === "match") {
      await requireAction("invoice.match");
      await runMatch(id, userActor(user));
    } else if (action === "approve" || action === "pay" || action === "dispute" || action === "reopen") {
      await requireAction(action === "pay" ? "invoice.pay" : action === "approve" ? "invoice.approve" : "invoice.edit");
      await moveInvoice(id, action, user, note);
    } else return { error: "Unknown action" };
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  return { ok: true };
}
