"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAction } from "@/server/auth/session";
import { applyRun, discardRun, runAgent } from "@/server/agents/runner";
import { AGENT_KINDS } from "@/lib/constants";
import type { ActionResult } from "./po";

export type AgentResult = ActionResult & { runId?: string };

export async function runAgentAction(_p: AgentResult, formData: FormData): Promise<AgentResult> {
  const user = await requireAction("agents.run");
  const parsed = z.object({ kind: z.enum(AGENT_KINDS), prompt: z.string().trim().max(2000).optional(), invoiceId: z.string().uuid().optional().or(z.literal("")), vendorId: z.string().uuid().optional().or(z.literal("")) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the request." };
  if ((parsed.data.kind === "draft_po" || parsed.data.kind === "chat") && !parsed.data.prompt) return { error: "Describe what you need." };
  if (parsed.data.kind === "invoice_match" && !parsed.data.invoiceId) return { error: "Pick an invoice." };
  if (parsed.data.kind === "vendor_risk" && !parsed.data.vendorId) return { error: "Pick a vendor." };
  const run = await runAgent(parsed.data.kind, { prompt: parsed.data.prompt, invoiceId: parsed.data.invoiceId || undefined, vendorId: parsed.data.vendorId || undefined }, user.id);
  revalidatePath("/agents");
  if (run.status === "failed") return { error: run.error ?? "The agent failed.", runId: run.id };
  return { ok: true, runId: run.id };
}

export async function applyRunAction(id: string, submit: boolean) {
  const user = await requireAction("agents.apply");
  const r = await applyRun(id, user, { submit });
  revalidatePath("/agents");
  revalidatePath("/purchase-orders");
  if (r.entityType === "purchase_order") redirect(`/purchase-orders/${r.entityId}`);
  if (r.entityType === "invoice") redirect(`/invoices/${r.entityId}`);
}

export async function discardRunAction(id: string) {
  const user = await requireAction("agents.apply");
  await discardRun(id, user);
  revalidatePath("/agents");
}
