"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { applyRunAction, discardRunAction } from "@/server/actions/agents";
import { dateTime, money, num } from "@/lib/format";
import type { AgentRun } from "@/db/schema";
import { cn } from "@/lib/utils";

const TONE: Record<AgentRun["status"], "warn" | "ok" | "neutral" | "bad" | "blue"> = { running: "blue", proposed: "warn", applied: "ok", discarded: "neutral", failed: "bad" };
const KIND_LABEL: Record<string, string> = { draft_po: "Draft PO", reorder: "Reorder", invoice_match: "Invoice match", vendor_risk: "Vendor risk", chat: "Chat" };

export function RunCard({ run, canApply }: { run: AgentRun; canApply: boolean }) {
  const [open, setOpen] = useState(run.status === "proposed");
  const [pending, start] = useTransition();
  const p = run.proposal as { lines?: { sku: string; description: string; qty: number; unitCost: number; reason?: string }[]; rationale?: string; total?: number; decision?: string; reasoning?: string; vendorId?: string; warehouseCode?: string } | null;
  return (
    <li className="rounded-card border border-line bg-white shadow-card">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <Badge tone={TONE[run.status]}>{run.status}</Badge>
        <span className="text-[13px] font-semibold">{KIND_LABEL[run.kind] ?? run.kind}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{run.summary || run.error || (run.input as { prompt?: string }).prompt || ""}</span>
        <span className="text-[11.5px] text-ink-faint">{dateTime(run.createdAt)} · {run.model || "—"} · {num(run.promptTokens + run.completionTokens)} tok · {(run.durationMs / 1000).toFixed(1)}s</span>
        <ChevronDown className={cn("size-4 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {(run.input as { prompt?: string }).prompt ? <p className="text-[13px]"><span className="font-medium text-ink-soft">Request:</span> {(run.input as { prompt?: string }).prompt}</p> : null}
          {run.summary ? <div className="whitespace-pre-line rounded-card bg-tint/70 p-3 text-[13.5px]">{run.summary}</div> : null}
          {run.error ? <div className="rounded-card bg-bad-bg p-3 text-[13px] text-bad-fg">{run.error}</div> : null}
          {p?.lines ? (
            <div className="rounded-card border border-line">
              <p className="border-b border-line px-3 py-2 text-[12.5px] font-medium">Proposed purchase order · {p.warehouseCode ?? "SIN-HQ"} · {money(p.total ?? 0)}</p>
              <table className="w-full text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="px-3 py-1.5">SKU</th><th className="px-3 py-1.5">Item</th><th className="px-3 py-1.5 text-right">Qty</th><th className="px-3 py-1.5 text-right">Unit</th><th className="px-3 py-1.5">Reason</th></tr></thead>
                <tbody>{p.lines.map((l, i) => <tr key={i} className="border-t border-line"><td className="px-3 py-1.5 font-mono text-[12px]">{l.sku}</td><td className="px-3 py-1.5">{l.description}</td><td className="px-3 py-1.5 text-right">{num(l.qty)}</td><td className="px-3 py-1.5 text-right">{money(l.unitCost)}</td><td className="px-3 py-1.5 text-ink-soft">{l.reason}</td></tr>)}</tbody>
              </table>
              {p.rationale ? <p className="border-t border-line px-3 py-2 text-[12.5px] text-ink-soft">{p.rationale}</p> : null}
            </div>
          ) : null}
          {p?.decision ? <p className="text-[13px]"><span className="font-medium">Recommendation:</span> {p.decision} — {p.reasoning}</p> : null}
          {run.status === "proposed" && canApply ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="success" loading={pending} onClick={() => start(() => applyRunAction(run.id, false))}>{p?.lines ? "Apply as draft PO" : "Apply"}</Button>
              {p?.lines ? <Button size="sm" loading={pending} onClick={() => start(() => applyRunAction(run.id, true))}>Apply &amp; submit for approval</Button> : null}
              <Button size="sm" variant="ghost" loading={pending} onClick={() => start(() => discardRunAction(run.id))}>Discard</Button>
            </div>
          ) : null}
          {run.status === "applied" && run.resultEntityId ? <Link href={`/${run.resultEntityType === "invoice" ? "invoices" : "purchase-orders"}/${run.resultEntityId}`} className="text-[13px] text-blue hover:underline">Open the {run.resultEntityType?.replace("_", " ")} that was created →</Link> : null}
          <details className="text-[12px]">
            <summary className="cursor-pointer text-ink-faint">Tool trace ({run.trace.length} steps)</summary>
            <pre className="mt-2 max-h-72 overflow-auto rounded-card bg-wash p-3 text-[11.5px]">{JSON.stringify(run.trace, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </li>
  );
}
