"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Table, Td, Th } from "@/components/ui/table";
import { money } from "@/lib/format";
import { poTotals } from "@/lib/po-status";
import { createInvoiceAction } from "@/server/actions/invoice";
import type { ActionResult } from "@/server/actions/po";

type PoOpt = { id: string; poNumber: string; vendorId: string; lines: { skuId: string | null; description: string; qty: number; qtyReceived: number; unitCost: number }[] };
type Line = { key: number; skuId: string | null; description: string; qty: number; unitCost: number };

export function InvoiceForm({ vendors, pos, initialPoId }: { vendors: { id: string; name: string }[]; pos: PoOpt[]; initialPoId?: string }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(createInvoiceAction, {});
  const initialPo = pos.find((p) => p.id === initialPoId);
  const [vendorId, setVendorId] = useState(initialPo?.vendorId ?? "");
  const [poId, setPoId] = useState(initialPo?.id ?? "");
  const [lines, setLines] = useState<Line[]>(initialPo ? initialPo.lines.map((l, i) => ({ key: i + 1, skuId: l.skuId, description: l.description, qty: l.qtyReceived || l.qty, unitCost: l.unitCost })) : [{ key: 1, skuId: null, description: "", qty: 1, unitCost: 0 }]);
  const [nextKey, setNextKey] = useState(lines.length + 1);
  const totals = useMemo(() => poTotals(lines, 0), [lines]);
  const vendorPos = pos.filter((p) => !vendorId || p.vendorId === vendorId);

  function choosePo(id: string) {
    setPoId(id);
    const po = pos.find((p) => p.id === id);
    if (po) {
      setVendorId(po.vendorId);
      setLines(po.lines.map((l, i) => ({ key: i + 1, skuId: l.skuId, description: l.description, qty: l.qtyReceived || l.qty, unitCost: l.unitCost })));
      setNextKey(po.lines.length + 1);
    }
  }
  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <input type="hidden" name="lines" value={JSON.stringify(lines.map((l) => ({ skuId: l.skuId, description: l.description, qty: l.qty, unitCost: l.unitCost })))} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Purchase order" htmlFor="poId" hint="Pre-fills lines from what was received">
          <Select id="poId" name="poId" value={poId} onChange={(e) => choosePo(e.target.value)}>
            <option value="">— none —</option>
            {vendorPos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.poNumber}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor" htmlFor="vendorId">
          <Select id="vendorId" name="vendorId" required value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Choose…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vendor invoice number" htmlFor="invoiceNumber">
          <Input id="invoiceNumber" name="invoiceNumber" required placeholder="e.g. ORB-2026-0512" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Issued" htmlFor="issuedAt">
            <Input id="issuedAt" name="issuedAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Field label="Due" htmlFor="dueAt">
            <Input id="dueAt" name="dueAt" type="date" />
          </Field>
        </div>
      </div>
      <div className="rounded-card border border-line">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Lines</h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setLines((ls) => [...ls, { key: nextKey, skuId: null, description: "", qty: 1, unitCost: 0 }]); setNextKey((k) => k + 1); }}>
            <Plus className="size-3.5" /> Add line
          </Button>
        </div>
        <Table>
          <thead>
            <tr>
              <Th>Description</Th>
              <Th right className="w-[110px]">Qty</Th>
              <Th right className="w-[140px]">Unit price</Th>
              <Th right className="w-[130px]">Total</Th>
              <Th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key}>
                <Td><Input value={l.description} onChange={(e) => update(l.key, { description: e.target.value })} aria-label="Description" required /></Td>
                <Td><Input type="number" min={1} value={l.qty} onChange={(e) => update(l.key, { qty: Number(e.target.value) })} className="text-right" aria-label="Quantity" /></Td>
                <Td><Input type="number" min={0} step="0.01" value={l.unitCost} onChange={(e) => update(l.key, { unitCost: Number(e.target.value) })} className="text-right" aria-label="Unit price" /></Td>
                <Td right>{money(l.qty * l.unitCost)}</Td>
                <Td><button type="button" className="text-ink-faint hover:text-bad-fg" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 className="size-4" /></button></Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <Td colSpan={3} right className="font-semibold">Total (USD)</Td>
              <Td right className="text-[15px] font-bold text-blue">{money(totals.total)}</Td>
              <Td />
            </tr>
          </tfoot>
        </Table>
      </div>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" className="min-h-16" />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>Record invoice &amp; run 3-way match</Button>
      </div>
    </form>
  );
}
