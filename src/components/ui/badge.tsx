import * as React from "react";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABEL, PO_STATUS_LABEL, type InvoiceStatus, type PoStatus } from "@/lib/constants";

export type Tone = "ok" | "warn" | "bad" | "blue" | "neutral" | "sky";

const tones: Record<Tone, string> = {
  ok: "bg-ok-bg text-ok-fg",
  warn: "bg-warn-bg text-warn-fg",
  bad: "bg-bad-bg text-bad-fg",
  blue: "bg-accent-tint text-blue",
  sky: "bg-tint text-sky",
  neutral: "bg-wash text-ink-soft",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export const PO_TONE: Record<PoStatus, Tone> = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "blue",
  rejected: "bad",
  ordered: "sky",
  received: "ok",
  closed: "neutral",
  cancelled: "neutral",
};

export const INVOICE_TONE: Record<InvoiceStatus, Tone> = {
  draft: "neutral",
  received: "sky",
  matched: "blue",
  approved: "blue",
  paid: "ok",
  disputed: "bad",
};

export function PoStatusBadge({ status }: { status: PoStatus }) {
  return <Badge tone={PO_TONE[status]}>{PO_STATUS_LABEL[status]}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={INVOICE_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

export function StockBadge({ qty, reorder }: { qty: number; reorder: number }) {
  if (qty <= 0) return <Badge tone="bad">Out of stock</Badge>;
  if (qty < reorder) return <Badge tone="warn">Low stock</Badge>;
  return <Badge tone="ok">In stock</Badge>;
}
