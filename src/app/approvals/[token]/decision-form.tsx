"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { decideByTokenAction, type TokenDecisionState } from "@/server/actions/approval";

export function DecisionForm({ token, action, poId, disabled }: { token: string; action: "approve" | "reject"; poId: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState<TokenDecisionState, FormData>(decideByTokenAction, {});
  if (state.done) {
    return (
      <div className="space-y-4">
        {state.ok ? (
          <Alert tone="ok" title={`${state.poNumber} ${state.action === "approve" ? "approved" : "rejected"}`}>
            The requester has been notified and the decision is on the purchase order timeline.
          </Alert>
        ) : (
          <Alert tone="bad">{state.message}</Alert>
        )}
        <Link href={`/purchase-orders/${poId}`} className="text-[13.5px] text-blue hover:underline">
          Open the purchase order in the ERP
        </Link>
      </div>
    );
  }
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="token" value={token} />
      <Button type="submit" variant={action === "approve" ? "success" : "danger"} size="lg" loading={pending} disabled={disabled}>
        Confirm {action === "approve" ? "approval" : "rejection"}
      </Button>
      <span className="text-[12.5px] text-ink-faint">This link is single-use and expires 72 hours after the request was sent.</span>
    </form>
  );
}
