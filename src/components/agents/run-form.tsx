"use client";

import { useActionState } from "react";
import { Bot, FileSearch, PackageSearch, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { runAgentAction, type AgentResult } from "@/server/actions/agents";
import type { AgentKind } from "@/lib/constants";

const KINDS: { kind: AgentKind; title: string; desc: string; icon: typeof Bot; cta: string }[] = [
  { kind: "draft_po", title: "Draft a purchase order", desc: "Describe what a site needs in plain language; the agent resolves SKUs, picks the preferred vendor and proposes a PO.", icon: Sparkles, cta: "Draft PO" },
  { kind: "reorder", title: "Reorder recommendations", desc: "Reviews every SKU below reorder level and proposes the most urgent vendor order, with reasoning.", icon: PackageSearch, cta: "Run reorder review" },
  { kind: "invoice_match", title: "Invoice match assistant", desc: "Explains 3-way match discrepancies on an invoice and recommends approve, dispute or hold.", icon: FileSearch, cta: "Analyse invoice" },
  { kind: "vendor_risk", title: "Vendor risk summary", desc: "Rates a vendor's risk from lead times, disputes and concentration of critical SKUs.", icon: ShieldAlert, cta: "Assess vendor" },
];

export function AgentRunForm({ kind, invoices, vendors, disabled }: { kind: AgentKind; invoices: { id: string; label: string }[]; vendors: { id: string; label: string }[]; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<AgentResult, FormData>(runAgentAction, {});
  const meta = KINDS.find((k) => k.kind === kind)!;
  const Icon = meta.icon;
  return (
    <form action={formAction} className="flex h-full flex-col rounded-card border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="kind" value={kind} />
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-sky"><Icon className="size-5" /></span>
        <div>
          <h2 className="text-[15px] font-semibold">{meta.title}</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">{meta.desc}</p>
        </div>
      </div>
      <div className="mt-4 flex-1 space-y-3">
        {kind === "draft_po" ? (
          <Field label="What is needed?" htmlFor={`prompt-${kind}`}>
            <Textarea id={`prompt-${kind}`} name="prompt" placeholder="e.g. 20 Gigstarter 1.2 m terminal kits and 20 solar kits for the Suva depot by end of month" className="min-h-20" />
          </Field>
        ) : null}
        {kind === "invoice_match" ? (
          <Field label="Invoice" htmlFor="invoiceId">
            <Select id="invoiceId" name="invoiceId" defaultValue={invoices[0]?.id ?? ""}>{invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</Select>
          </Field>
        ) : null}
        {kind === "vendor_risk" ? (
          <Field label="Vendor" htmlFor="vendorId">
            <Select id="vendorId" name="vendorId" defaultValue={vendors[0]?.id ?? ""}>{vendors.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</Select>
          </Field>
        ) : null}
        {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
        {state.ok ? <Alert tone="ok">Done — review the result in the run history below.</Alert> : null}
      </div>
      <div className="mt-4"><Button type="submit" size="sm" loading={pending} disabled={disabled}>{pending ? "Thinking…" : meta.cta}</Button></div>
    </form>
  );
}

export function AgentChat({ disabled }: { disabled: boolean }) {
  const [state, formAction, pending] = useActionState<AgentResult, FormData>(runAgentAction, {});
  return (
    <form action={formAction} className="rounded-card border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="kind" value="chat" />
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue text-white"><Bot className="size-5" /></span>
        <div className="flex-1">
          <h2 className="text-[15px] font-semibold">Ask the co-pilot</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">“How many KX-100 modems are in Suva?” · “What&apos;s the status of PO-2026-0012?” · “Raise a PO for 50 LNBs to Manila.”</p>
          <div className="mt-3 flex gap-2">
            <Textarea name="prompt" placeholder="Ask about stock, POs, vendors or invoices…" className="min-h-12 flex-1" />
            <Button type="submit" loading={pending} disabled={disabled}>Ask</Button>
          </div>
          {state.error ? <Alert tone="bad" className="mt-3">{state.error}</Alert> : null}
          {state.ok ? <Alert tone="ok" className="mt-3">Answered — see the newest run below.</Alert> : null}
        </div>
      </div>
    </form>
  );
}
