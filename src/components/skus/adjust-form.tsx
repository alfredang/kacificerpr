"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { adjustStockAction } from "@/server/actions/sku";
import type { ActionResult } from "@/server/actions/po";

export function AdjustForm({ skuId, warehouses }: { skuId: string; warehouses: { id: string; code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(adjustStockAction, {});
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-[1fr_120px_140px_1fr_auto] md:items-end" noValidate>
      <input type="hidden" name="skuId" value={skuId} />
      <Field label="Depot" htmlFor="warehouseId"><Select id="warehouseId" name="warehouseId">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
      <Field label="± Qty" htmlFor="delta"><Input id="delta" name="delta" type="number" required placeholder="-5" /></Field>
      <Field label="Reason" htmlFor="reason">
        <Select id="reason" name="reason" defaultValue="adjustment"><option value="adjustment">Adjustment</option><option value="issue">Issued to site</option><option value="transfer">Transfer</option><option value="receipt">Receipt (no PO)</option></Select>
      </Field>
      <Field label="Note" htmlFor="note"><Input id="note" name="note" placeholder="Stock count, site install…" /></Field>
      <Button type="submit" variant="secondary" loading={pending}>Apply</Button>
      {state.error ? <div className="md:col-span-5"><Alert tone="bad">{state.error}</Alert></div> : null}
      {state.ok ? <div className="md:col-span-5"><Alert tone="ok">Stock updated.</Alert></div> : null}
    </form>
  );
}
