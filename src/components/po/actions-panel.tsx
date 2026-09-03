"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { ACTION_LABEL, type PoAction } from "@/lib/po-status";
import { poTransitionAction, type ActionResult } from "@/server/actions/po";

type LineInfo = { id: string; description: string; qty: number; qtyReceived: number };

export function PoActionsPanel({ poId, actions, lines }: { poId: string; actions: PoAction[]; lines: LineInfo[] }) {
  const [open, setOpen] = useState<PoAction | null>(null);
  const bound = poTransitionAction.bind(null, poId, open ?? "");
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(bound, {});

  if (actions.length === 0) return null;
  const variant = (a: PoAction) => (a === "approve" ? "success" : a === "reject" || a === "cancel" ? "danger" : a === "submit" || a === "order" || a === "receive" || a === "close" ? "primary" : "ghost");

  return (
    <div className="space-y-3">
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a} type="button" variant={variant(a)} size="sm" onClick={() => setOpen(open === a ? null : a)} aria-expanded={open === a}>
            {ACTION_LABEL[a]}
          </Button>
        ))}
      </div>
      {open ? (
        <form action={formAction} className="space-y-3 rounded-card border border-line bg-tint/60 p-4" data-testid={`po-action-${open}`}>
          {open === "receive" ? (
            <div className="space-y-2">
              <p className="text-[13px] text-ink-soft">Enter the quantity received per line. Partial receipts are fine — the PO stays “Ordered” until every line is complete.</p>
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_120px] items-center gap-3">
                  <span className="text-[13.5px]">
                    {l.description} <span className="text-ink-faint">({l.qtyReceived}/{l.qty} received)</span>
                  </span>
                  <Input type="number" name={`recv:${l.id}`} min={0} max={l.qty - l.qtyReceived} defaultValue={l.qty - l.qtyReceived} className="text-right" aria-label={`Received ${l.description}`} />
                </div>
              ))}
            </div>
          ) : open === "approve" || open === "reject" || open === "cancel" ? (
            <Field label={open === "reject" ? "Reason (sent to the requester)" : "Note (optional)"} htmlFor="note">
              <Textarea id="note" name="note" required={open === "reject"} className="min-h-16" />
            </Field>
          ) : (
            <p className="text-[13.5px] text-ink-soft">
              {open === "submit"
                ? "Managers will receive an email with one-click approve / reject links and an Asana task will be created if the integration is enabled."
                : `Confirm: ${ACTION_LABEL[open].toLowerCase()}.`}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant={variant(open)} loading={pending}>
              Confirm {ACTION_LABEL[open].toLowerCase()}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(null)}>
              Back
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
