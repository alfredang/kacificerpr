"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { money } from "@/lib/format";
import { invoiceTransitionAction } from "@/server/actions/invoice";
import type { ActionResult } from "@/server/actions/po";
import type { Invoice } from "@/db/schema";

const LAMPS: { key: keyof NonNullable<Invoice["match"]>; label: string; desc: string; fail: string }[] = [
  { key: "poMatch", label: "Purchase order", desc: "Linked PO exists and the vendor matches", fail: "No matching purchase order, or the vendor differs" },
  { key: "qtyMatch", label: "Quantity ordered", desc: "Invoiced quantities do not exceed the PO", fail: "Invoiced more than was ordered" },
  { key: "receiptMatch", label: "Goods receipt", desc: "Invoiced quantities were actually received", fail: "Invoiced more than has been received" },
  { key: "priceMatch", label: "Unit price", desc: "Within the price tolerance in company settings", fail: "Unit price outside the tolerance" },
];

export function MatchPanel({ invoice, actions }: { invoice: Pick<Invoice, "id" | "status" | "match" | "total">; actions: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const bound = invoiceTransitionAction.bind(null, invoice.id, open ?? "");
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(bound, {});
  // Close the confirm panel once the action succeeds (derived state, no effect).
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.ok) setOpen(null);
  }
  const m = invoice.match;
  const label: Record<string, string> = { match: "Run 3-way match", approve: "Approve for payment", pay: "Mark as paid", dispute: "Dispute", reopen: "Reopen" };
  const variant = (a: string) => (a === "approve" || a === "pay" ? "success" : a === "dispute" ? "danger" : a === "match" ? "primary" : "ghost");
  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {LAMPS.map((l) => {
          const ok = m ? Boolean(m[l.key]) : null;
          return (
            <li key={l.key} className={`flex gap-3 rounded-card border px-3 py-2.5 ${ok === null ? "border-line bg-wash" : ok ? "border-ok-fg/20 bg-ok-bg" : "border-bad-fg/20 bg-bad-bg"}`}>
              {ok === null ? <span className="mt-0.5 size-4 rounded-full border-2 border-line-strong" /> : ok ? <CheckCircle2 className="mt-0.5 size-4 text-ok-fg" /> : <XCircle className="mt-0.5 size-4 text-bad-fg" />}
              <div>
                <p className="text-[13px] font-medium">{l.label}{ok === null ? "" : ok ? " — pass" : " — fail"}</p>
                <p className="text-[12px] text-ink-soft">{ok === false ? l.fail : l.desc}</p>
              </div>
            </li>
          );
        })}
      </ul>
      {m ? (
        <div className="text-[13px] text-ink-soft">
          <p>
            Variance vs PO: <strong className={m.variance === 0 ? "text-ok-fg" : "text-warn-fg"}>{money(m.variance)}</strong> · checked {new Date(m.checkedAt).toLocaleString()}
          </p>
          {m.notes.length ? <ul className="mt-1 list-disc pl-5">{m.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        </div>
      ) : (
        <p className="text-[13px] text-ink-faint">Not matched yet.</p>
      )}
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {actions.length ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a} type="button" size="sm" variant={variant(a)} onClick={() => setOpen(open === a ? null : a)}>
              {label[a]}
            </Button>
          ))}
        </div>
      ) : null}
      {open ? (
        <form action={formAction} className="space-y-3 rounded-card border border-line bg-tint/60 p-4">
          {open === "dispute" || open === "approve" ? (
            <Field label={open === "dispute" ? "Reason for dispute" : "Note (optional)"} htmlFor="note">
              <Textarea id="note" name="note" required={open === "dispute"} className="min-h-16" />
            </Field>
          ) : (
            <p className="text-[13.5px] text-ink-soft">Confirm: {label[open].toLowerCase()}.</p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant={variant(open)} loading={pending}>Confirm</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>Back</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
