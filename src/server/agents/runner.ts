import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, purchaseOrders, warehouses, type AgentRun } from "@/db/schema";
import type { AgentKind } from "@/lib/constants";
import { chat, deepseekConfig, type ChatMessage } from "@/server/integrations/deepseek";
import { audit, type Actor } from "@/server/services/audit";
import { createPo, submitPo, userActor } from "@/server/services/po";
import { moveInvoice } from "@/server/services/invoice";
import { lowStockList } from "@/server/services/sku";
import { KIND_PROMPTS, KIND_TOOLS, SYSTEM_BASE } from "./prompts";
import { runTool, toolDefs } from "./tools";
import type { User } from "@/db/schema";

const MAX_STEPS = 8;

/* The tool-calling loop. The run row is persisted first so a timeout leaves
   a `failed` record rather than nothing. Every tool call is traced. */
export async function runAgent(kind: AgentKind, input: { prompt?: string; invoiceId?: string; vendorId?: string }, requestedBy: string | null): Promise<AgentRun> {
  const db = getDb();
  const cfg = await deepseekConfig();
  const [run] = await db.insert(agentRuns).values({ kind, requestedBy, input, model: cfg.model }).returning();
  const started = Date.now();
  const trace: Array<Record<string, unknown>> = [];
  let promptTokens = 0;
  let completionTokens = 0;
  let proposal: Record<string, unknown> | null = null;
  let summary = "";

  try {
    if (!cfg.enabled) throw new Error("DeepSeek is not configured. Add an API key in Settings → Integrations.");
    const userMsg =
      kind === "invoice_match" ? `Invoice id: ${input.invoiceId}` : kind === "vendor_risk" ? `Vendor id: ${input.vendorId}` : kind === "reorder" ? "Run the reorder review now." : (input.prompt ?? "");
    const messages: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_BASE}\n\n${KIND_PROMPTS[kind]}` },
      { role: "user", content: userMsg },
    ];
    const tools = toolDefs(KIND_TOOLS[kind]);

    if (cfg.mock) {
      const r = await mockRun(kind, input);
      proposal = r.proposal;
      summary = r.summary;
      trace.push({ step: 1, mock: true, toolCalls: r.toolCalls });
    } else {
      for (let step = 1; step <= MAX_STEPS; step++) {
        const res = await chat(messages, { tools });
        promptTokens += res.usage.prompt_tokens;
        completionTokens += res.usage.completion_tokens;
        const msg = res.message;
        messages.push({ role: "assistant", content: msg.content, tool_calls: msg.tool_calls });
        if (!msg.tool_calls?.length) {
          summary = msg.content ?? "";
          trace.push({ step, assistant: summary });
          break;
        }
        for (const call of msg.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {}
          const result = await runTool(call.function.name, args);
          trace.push({ step, tool: call.function.name, args, result: truncate(result) });
          if (call.function.name.startsWith("propose_") && result && typeof result === "object" && "proposal" in result) {
            proposal = (result as { proposal: Record<string, unknown> }).proposal;
          }
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 12_000) });
        }
        if (step === MAX_STEPS) summary = messages.findLast((m) => m.role === "assistant" && m.content)?.content?.toString() ?? "Stopped after the maximum number of steps.";
      }
    }
    const [done] = await db
      .update(agentRuns)
      .set({ status: proposal ? "proposed" : "applied", proposal, summary, trace, promptTokens, completionTokens, durationMs: Date.now() - started, model: cfg.model, ...(proposal ? {} : { reviewedAt: new Date() }) })
      .where(eq(agentRuns.id, run.id))
      .returning();
    await audit({ actor: requestedBy ? { type: "user", id: requestedBy, label: "user" } : { type: "system", label: "Scheduler" }, action: "agent.run", entityType: "agent_run", entityId: run.id, payload: { kind, status: done.status, tokens: promptTokens + completionTokens } });
    return done;
  } catch (err) {
    const [failed] = await db
      .update(agentRuns)
      .set({ status: "failed", error: err instanceof Error ? err.message : String(err), trace, durationMs: Date.now() - started })
      .where(eq(agentRuns.id, run.id))
      .returning();
    return failed;
  }
}

function truncate(v: unknown) {
  const s = JSON.stringify(v) ?? "";
  return s.length > 4000 ? { truncated: s.slice(0, 4000) + "…" } : v;
}

/* Deterministic stand-in used by e2e (AI_MOCK=1): exercises the same tools. */
async function mockRun(kind: AgentKind, input: { prompt?: string; invoiceId?: string; vendorId?: string }) {
  const toolCalls: string[] = [];
  if (kind === "reorder" || kind === "draft_po") {
    toolCalls.push("get_low_stock");
    const low = (await lowStockList()).filter((l) => l.vendor && l.suggestedQty > 0);
    const vendor = low[0]?.vendor;
    if (!vendor) return { proposal: null, summary: "Nothing is below reorder level, so no purchase order is needed.", toolCalls };
    const lines = low.filter((l) => l.vendor?.id === vendor.id).map((l) => ({ sku: l.sku, qty: l.suggestedQty, reason: `${l.qty} on hand vs reorder level ${l.reorderLevel}` }));
    toolCalls.push("propose_purchase_order");
    const r = (await runTool("propose_purchase_order", { vendorId: vendor.id, warehouseCode: "SIN-HQ", rationale: `Replenish ${lines.length} SKU(s) below reorder level from preferred vendor ${vendor.name} (${vendor.leadTimeDays}-day lead time).`, lines })) as { proposal: Record<string, unknown> };
    return { proposal: r.proposal, summary: `[mock] Proposed a PO to ${vendor.name} for ${lines.length} low-stock SKU(s): ${lines.map((l) => `${l.qty} × ${l.sku}`).join(", ")}.`, toolCalls };
  }
  if (kind === "invoice_match") {
    toolCalls.push("get_invoice", "propose_invoice_match");
    const inv = (await runTool("get_invoice", { id: input.invoiceId })) as { match?: { poMatch: boolean; qtyMatch: boolean; receiptMatch: boolean; priceMatch: boolean; notes: string[] } };
    const ok = inv.match && inv.match.poMatch && inv.match.qtyMatch && inv.match.receiptMatch && inv.match.priceMatch;
    const proposal = { invoiceId: input.invoiceId, decision: ok ? "approve" : "dispute", reasoning: ok ? "All four checks pass." : (inv.match?.notes ?? ["No match run"]).join(" ") };
    return { proposal, summary: `[mock] Recommend ${proposal.decision}: ${proposal.reasoning}`, toolCalls };
  }
  if (kind === "vendor_risk") {
    toolCalls.push("get_vendor");
    const v = (await runTool("get_vendor", { id: input.vendorId })) as { name?: string; disputedInvoices?: number; leadTimeDays?: number };
    return { proposal: null, summary: `[mock] ${v.name}: ${v.disputedInvoices ? "medium" : "low"} risk — ${v.disputedInvoices ?? 0} disputed invoice(s), ${v.leadTimeDays}-day lead time.`, toolCalls };
  }
  toolCalls.push("dashboard_summary");
  const k = (await runTool("dashboard_summary", {})) as Record<string, unknown>;
  return { proposal: null, summary: `[mock] ${JSON.stringify(k)}`, toolCalls };
}

export async function listRuns(limit = 30) {
  return getDb().query.agentRuns.findMany({ orderBy: (r, { desc }) => [desc(r.createdAt)], limit });
}

export async function getRun(id: string) {
  return getDb().query.agentRuns.findFirst({ where: eq(agentRuns.id, id) });
}

/* Human-in-the-loop: applying a proposal is the only path that writes. */
export async function applyRun(id: string, user: User, opts: { submit?: boolean } = {}) {
  const db = getDb();
  const run = await getRun(id);
  if (!run || run.status !== "proposed" || !run.proposal) throw new Error("Nothing to apply");
  const actor: Actor = userActor(user);
  let entityType = "";
  let entityId = "";
  if (run.kind === "draft_po" || run.kind === "reorder" || run.kind === "chat") {
    const p = run.proposal as { vendorId: string; warehouseCode?: string; neededBy?: string; rationale?: string; lines: { skuId: string | null; description: string; qty: number; unitCost: number }[] };
    const wh = (await db.select().from(warehouses).where(eq(warehouses.code, p.warehouseCode ?? "SIN-HQ")))[0] ?? (await db.select().from(warehouses).limit(1))[0];
    const po = await createPo({ vendorId: p.vendorId, warehouseId: wh.id, neededBy: p.neededBy ?? null, notes: `Agent proposal (${run.kind}): ${p.rationale ?? ""}`, source: "agent", lines: p.lines.filter((l) => l.qty > 0) }, { type: "agent", id: run.id, label: `DeepSeek agent (applied by ${user.name})` }, user.id);
    await db.update(agentRuns).set({ status: "applied", reviewedBy: user.id, reviewedAt: new Date(), resultEntityType: "purchase_order", resultEntityId: po.id }).where(eq(agentRuns.id, id));
    await db.update(purchaseOrders).set({ agentRunId: run.id }).where(eq(purchaseOrders.id, po.id));
    if (opts.submit) await submitPo(po.id, user);
    entityType = "purchase_order";
    entityId = po.id;
  } else if (run.kind === "invoice_match") {
    const p = run.proposal as { invoiceId: string; decision: "approve" | "dispute" | "hold"; reasoning: string };
    if (p.decision !== "hold") await moveInvoice(p.invoiceId, p.decision, user, `Agent recommendation: ${p.reasoning}`);
    await db.update(agentRuns).set({ status: "applied", reviewedBy: user.id, reviewedAt: new Date(), resultEntityType: "invoice", resultEntityId: p.invoiceId }).where(eq(agentRuns.id, id));
    entityType = "invoice";
    entityId = p.invoiceId;
  }
  await audit({ actor, action: "agent.apply", entityType: "agent_run", entityId: id, payload: { result: `${entityType}:${entityId}` } });
  return { entityType, entityId };
}

export async function discardRun(id: string, user: User) {
  await getDb().update(agentRuns).set({ status: "discarded", reviewedBy: user.id, reviewedAt: new Date() }).where(eq(agentRuns.id, id));
  await audit({ actor: userActor(user), action: "agent.discard", entityType: "agent_run", entityId: id });
}
