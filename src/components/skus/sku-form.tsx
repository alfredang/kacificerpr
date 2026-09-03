"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { SKU_CATEGORIES } from "@/lib/constants";
import { saveSkuAction } from "@/server/actions/sku";
import type { ActionResult } from "@/server/actions/po";
import type { Sku } from "@/db/schema";

export function SkuForm({ sku, vendors }: { sku?: Sku; vendors: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveSkuAction.bind(null, sku?.id ?? null), {});
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="SKU code" htmlFor="sku"><Input id="sku" name="sku" required defaultValue={sku?.sku ?? ""} placeholder="TRM-1200" /></Field>
        <Field label="Name" htmlFor="name" className="md:col-span-2"><Input id="name" name="name" required defaultValue={sku?.name ?? ""} /></Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={sku?.category ?? "Terminals"}>{SKU_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field label="Unit" htmlFor="unit"><Input id="unit" name="unit" defaultValue={sku?.unit ?? "ea"} /></Field>
        <Field label="Unit cost (USD)" htmlFor="unitCost"><Input id="unitCost" name="unitCost" type="number" step="0.01" min={0} defaultValue={sku?.unitCost ?? 0} /></Field>
        <Field label="Reorder level" htmlFor="reorderLevel" hint="Network-wide on-hand below this triggers low stock"><Input id="reorderLevel" name="reorderLevel" type="number" min={0} defaultValue={sku?.reorderLevel ?? 0} /></Field>
        <Field label="Reorder quantity" htmlFor="reorderQty"><Input id="reorderQty" name="reorderQty" type="number" min={0} defaultValue={sku?.reorderQty ?? 0} /></Field>
        <Field label="Lead time (days)" htmlFor="leadTimeDays"><Input id="leadTimeDays" name="leadTimeDays" type="number" min={0} defaultValue={sku?.leadTimeDays ?? 14} /></Field>
        <Field label="Preferred vendor" htmlFor="preferredVendorId">
          <Select id="preferredVendorId" name="preferredVendorId" defaultValue={sku?.preferredVendorId ?? ""}>
            <option value="">— none —</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
        <div className="flex items-end pb-2"><Checkbox name="isActive" label="Active SKU" defaultChecked={sku?.isActive ?? true} /></div>
      </div>
      <div className="flex justify-end"><Button type="submit" loading={pending}>{sku ? "Save SKU" : "Create SKU"}</Button></div>
    </form>
  );
}
