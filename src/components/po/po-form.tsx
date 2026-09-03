"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Table, Td, Th } from "@/components/ui/table";
import { money } from "@/lib/format";
import { poTotals } from "@/lib/po-status";
import type { ActionResult } from "@/server/actions/po";

export type SkuOption = { id: string; sku: string; name: string; unitCost: number; preferredVendorId: string | null; qty: number; reorderLevel: number };
export type Line = { key: number; skuId: string | null; description: string; qty: number; unitCost: number };

export function PoForm({
  vendors,
  warehouses,
  skus,
  initial,
  action,
  canSubmit,
  submitLabel = "Save draft",
}: {
  vendors: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  skus: SkuOption[];
  initial?: { vendorId?: string; warehouseId?: string; neededBy?: string | null; notes?: string; lines?: Omit<Line, "key">[]; source?: string };
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  canSubmit: boolean;
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});
  const [vendorId, setVendorId] = useState(initial?.vendorId ?? "");
  const [lines, setLines] = useState<Line[]>(
    (initial?.lines?.length ? initial.lines : [{ skuId: null, description: "", qty: 1, unitCost: 0 }]).map((l, i) => ({ ...l, key: i + 1 })),
  );
  const [nextKey, setNextKey] = useState(lines.length + 1);
  const totals = useMemo(() => poTotals(lines, 0), [lines]);
  const vendorSkus = useMemo(() => (vendorId ? skus.filter((s) => s.preferredVendorId === vendorId) : skus), [vendorId, skus]);
  const lowForVendor = vendorSkus.filter((s) => s.qty < s.reorderLevel && !lines.some((l) => l.skuId === s.id));

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function pickSku(key: number, skuId: string) {
    const s = skus.find((x) => x.id === skuId);
    update(key, s ? { skuId: s.id, description: s.name, unitCost: s.unitCost } : { skuId: null });
  }
  function addLine(preset?: Partial<Line>) {
    setLines((ls) => [...ls, { key: nextKey, skuId: null, description: "", qty: 1, unitCost: 0, ...preset }]);
    setNextKey((k) => k + 1);
  }

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ skuId: l.skuId, description: l.description, qty: l.qty, unitCost: l.unitCost })))} />
      {initial?.source ? <input type="hidden" name="source" value={initial.source} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Vendor" htmlFor="vendorId">
          <Select id="vendorId" name="vendorId" required value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Choose a vendor…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Deliver to depot" htmlFor="warehouseId">
          <Select id="warehouseId" name="warehouseId" required defaultValue={initial?.warehouseId ?? ""}>
            <option value="">Choose a depot…</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Needed by" htmlFor="neededBy">
          <Input id="neededBy" name="neededBy" type="date" defaultValue={initial?.neededBy ?? ""} />
        </Field>
      </div>

      <div className="rounded-card border border-line">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Lines</h2>
          <div className="flex gap-2">
            {lowForVendor.length ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => lowForVendor.forEach((s) => addLine({ skuId: s.id, description: s.name, unitCost: s.unitCost, qty: Math.max(1, s.reorderLevel - s.qty) }))}>
                Suggest {lowForVendor.length} low-stock SKU{lowForVendor.length === 1 ? "" : "s"}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="sm" onClick={() => addLine()}>
              <Plus className="size-3.5" /> Add line
            </Button>
          </div>
        </div>
        <Table>
          <thead>
            <tr>
              <Th className="w-[200px]">SKU</Th>
              <Th>Description</Th>
              <Th right className="w-[110px]">Qty</Th>
              <Th right className="w-[140px]">Unit cost</Th>
              <Th right className="w-[130px]">Total</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <Td>
                  <Select value={l.skuId ?? ""} onChange={(e) => pickSku(l.key, e.target.value)} aria-label="SKU">
                    <option value="">— free text —</option>
                    {vendorSkus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sku}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>
                  <Input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} placeholder="Item description" aria-label="Description" required />
                </Td>
                <Td>
                  <Input type="number" min={1} step={1} value={l.qty} onChange={(e) => update(l.key, { qty: Number(e.target.value) })} className="text-right" aria-label="Quantity" />
                </Td>
                <Td>
                  <Input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => update(l.key, { unitCost: Number(e.target.value) })} className="text-right" aria-label="Unit cost" />
                </Td>
                <Td right>{money(l.qty * l.unitCost)}</Td>
                <Td>
                  <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-ink-faint hover:text-bad-fg" aria-label="Remove line" disabled={lines.length === 1}>
                    <Trash2 className="size-4" />
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td colSpan={4} right className="font-semibold">
                Total (USD)
              </Td>
              <Td right className="text-[15px] font-bold text-blue">
                {money(totals.total)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Table>
      </div>

      <Field label="Notes for the approver" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={initial?.notes ?? ""} placeholder="Why is this needed? Site, project, urgency…" />
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" variant="secondary" loading={pending}>
          {submitLabel}
        </Button>
        {canSubmit ? (
          <Button type="submit" name="submit" value="1" loading={pending}>
            Save &amp; submit for approval
          </Button>
        ) : null}
      </div>
    </form>
  );
}
