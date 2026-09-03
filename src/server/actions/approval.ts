"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requestIp } from "@/server/auth/session";
import { rateLimit } from "@/server/security/rate-limit";
import { decideByToken } from "@/server/services/po";

export type TokenDecisionState = { done?: boolean; ok?: boolean; action?: "approve" | "reject"; poNumber?: string; message?: string };

/* Only ever reached by POST from the confirmation page — mail scanners that
   prefetch the GET never mutate anything. */
export async function decideByTokenAction(_prev: TokenDecisionState, formData: FormData): Promise<TokenDecisionState> {
  const token = String(formData.get("token") ?? "");
  const ip = await requestIp();
  const rl = await rateLimit(`approval:${ip ?? "?"}`, 20, 15 * 60_000);
  if (!rl.allowed) return { done: true, ok: false, message: "Too many attempts. Try again in a few minutes." };
  const r = await decideByToken(token, ip);
  revalidatePath("/purchase-orders");
  revalidatePath("/dashboard");
  if (!r.ok) {
    const msg =
      r.reason === "expired" ? "This link has expired." : r.reason === "conflict" ? (r.message ?? "This purchase order has already been decided.") : "This link is not valid or has already been used.";
    return { done: true, ok: false, message: msg };
  }
  /* The token is now consumed, so the page would re-render as "already used";
     redirect to a result view instead. */
  redirect(`/approvals/${token}?done=${r.action}&po=${encodeURIComponent(r.po.poNumber)}&id=${r.po.id}`);
}
