"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { saveVendorAction } from "@/server/actions/vendor";
import type { ActionResult } from "@/server/actions/po";
import type { Vendor } from "@/db/schema";

export function VendorForm({ vendor }: { vendor?: Vendor }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveVendorAction.bind(null, vendor?.id ?? null), {});
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Vendor code" htmlFor="code"><Input id="code" name="code" required defaultValue={vendor?.code ?? ""} placeholder="V-ACME" /></Field>
        <Field label="Name" htmlFor="name" className="md:col-span-2"><Input id="name" name="name" required defaultValue={vendor?.name ?? ""} /></Field>
        <Field label="Contact" htmlFor="contactName"><Input id="contactName" name="contactName" defaultValue={vendor?.contactName ?? ""} /></Field>
        <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={vendor?.email ?? ""} /></Field>
        <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={vendor?.phone ?? ""} /></Field>
        <Field label="Country" htmlFor="country"><Input id="country" name="country" defaultValue={vendor?.country ?? ""} /></Field>
        <Field label="Lead time (days)" htmlFor="leadTimeDays"><Input id="leadTimeDays" name="leadTimeDays" type="number" min={0} defaultValue={vendor?.leadTimeDays ?? 14} /></Field>
        <Field label="Payment terms (days)" htmlFor="paymentTermsDays"><Input id="paymentTermsDays" name="paymentTermsDays" type="number" min={0} defaultValue={vendor?.paymentTermsDays ?? 30} /></Field>
        <Field label="Currency" htmlFor="currency"><Input id="currency" name="currency" maxLength={3} defaultValue={vendor?.currency ?? "USD"} /></Field>
        <Field label="Rating" htmlFor="rating">
          <Select id="rating" name="rating" defaultValue={String(vendor?.rating ?? 3)}>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{"★".repeat(r)}{"☆".repeat(5 - r)}</option>)}
          </Select>
        </Field>
        <div className="flex items-end pb-2"><Checkbox name="isActive" label="Active vendor" defaultChecked={vendor?.isActive ?? true} /></div>
      </div>
      <Field label="Notes" htmlFor="notes"><Textarea id="notes" name="notes" defaultValue={vendor?.notes ?? ""} /></Field>
      <div className="flex justify-end"><Button type="submit" loading={pending}>{vendor ? "Save vendor" : "Create vendor"}</Button></div>
    </form>
  );
}
