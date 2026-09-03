"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction, requireUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { cancelPo, closePo, createPo, decidePo, orderPo, PoError, receivePo, reopenPo, submitPo, updatePo, userActor } from "@/server/services/po";

export type ActionResult = { error?: string; ok?: boolean };

const lineSchema = z.object({
  skuId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1).max(300),
  qty: z.coerce.number().int().positive().max(1_000_000),
  unitCost: z.coerce.number().nonnegative().max(10_000_000),
});
const poSchema = z.object({
  vendorId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
  source: z.enum(["manual", "low_stock", "agent", "api"]).optional(),
  lines: z.array(lineSchema).min(1).max(100),
});

function parsePo(formData: FormData) {
  let lines: unknown = [];
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    lines = [];
  }
  // An untouched "Add line" row must not invalidate an otherwise complete PO.
  if (Array.isArray(lines)) lines = lines.filter((l) => l && typeof l === "object" && String((l as { description?: string }).description ?? "").trim() && Number((l as { qty?: number }).qty) > 0);
  return poSchema.safeParse({
    vendorId: formData.get("vendorId"),
    warehouseId: formData.get("warehouseId"),
    neededBy: formData.get("neededBy") ?? "",
    notes: formData.get("notes") ?? "",
    source: formData.get("source") ?? "manual",
    lines,
  });
}

function fail(err: unknown): ActionResult {
  if (err instanceof PoError) return { error: err.message };
  if (err && typeof err === "object" && "digest" in err) throw err; // redirect()
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export async function createPoAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("po.create");
  const parsed = parsePo(formData);
  if (!parsed.success) return { error: "Check the vendor, depot and at least one line with a quantity." };
  let id: string;
  try {
    const po = await createPo({ ...parsed.data, neededBy: parsed.data.neededBy || null }, userActor(user), user.id);
    id = po.id;
    if (formData.get("submit") === "1" && can(user.role, "po.submit")) await submitPo(id, user);
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/purchase-orders");
  redirect(`/purchase-orders/${id}`);
}

export async function updatePoAction(id: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAction("po.edit");
  const parsed = parsePo(formData);
  if (!parsed.success) return { error: "Check the vendor, depot and at least one line with a quantity." };
  try {
    await updatePo(id, { ...parsed.data, neededBy: parsed.data.neededBy || null }, userActor(user));
    if (formData.get("submit") === "1" && can(user.role, "po.submit")) await submitPo(id, user);
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/purchase-orders/${id}`);
  redirect(`/purchase-orders/${id}`);
}

export async function poTransitionAction(id: string, action: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  try {
    switch (action) {
      case "submit":
        await requireAction("po.submit");
        await submitPo(id, user);
        break;
      case "approve":
      case "reject":
        await requireAction("po.approve");
        await decidePo(id, action, { actor: userActor(user), role: user.role, note, approverId: user.id, via: "app" });
        break;
      case "order":
        await requireAction("po.order");
        await orderPo(id, user);
        break;
      case "receive": {
        await requireAction("po.receive");
        const lines: { lineId: string; qty: number }[] = [];
        for (const [k, v] of formData.entries()) {
          if (k.startsWith("recv:")) lines.push({ lineId: k.slice(5), qty: Number(v) || 0 });
        }
        await receivePo(id, lines, user);
        break;
      }
      case "close":
        await requireAction("po.close");
        await closePo(id, user);
        break;
      case "cancel":
        await requireAction("po.cancel");
        await cancelPo(id, user, note);
        break;
      case "reopen":
        await requireAction("po.edit");
        await reopenPo(id, user);
        break;
      default:
        return { error: "Unknown action" };
    }
  } catch (err) {
    return fail(err);
  }
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  revalidatePath("/dashboard");
  return { ok: true };
}
