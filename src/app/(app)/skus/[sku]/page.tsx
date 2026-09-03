import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getSku, vendorsForPicker } from "@/server/services/sku";
import { SkuForm } from "@/components/skus/sku-form";
import { AdjustForm } from "@/components/skus/adjust-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PoStatusBadge, StockBadge } from "@/components/ui/badge";
import { KpiCard, PageHeader } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { dateTime, money, num } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "SKU" };

export default async function SkuPage({ params, searchParams }: { params: Promise<{ sku: string }>; searchParams: SearchParams }) {
  const user = await requireAction("sku.view");
  const { sku: code } = await params;
  const s = await getSku(decodeURIComponent(code));
  if (!s) notFound();
  const editing = sp((await searchParams).edit) === "1" && can(user.role, "sku.manage");
  const vendors = editing ? await vendorsForPicker() : [];
  return (
    <>
      <PageHeader eyebrow={`SKU ${s.sku} · ${s.category}`} title={<span className="flex items-center gap-3">{s.name} <StockBadge qty={s.qty} reorder={s.reorderLevel} /></span>} subtitle={`Preferred vendor ${s.preferredVendor?.name ?? "—"} · ${s.leadTimeDays}-day lead time · ${money(s.unitCost)} per ${s.unit}`}
        actions={<>
          {can(user.role, "po.create") && s.preferredVendor ? <Link href={`/purchase-orders/new?from=low-stock&vendor=${s.preferredVendor.id}`} className="rounded-pill border border-blue bg-blue px-4 py-2 text-[12.5px] font-medium uppercase text-white hover:bg-white hover:text-blue">Raise PO</Link> : null}
          {can(user.role, "sku.manage") && !editing ? <Link href={`/skus/${s.sku}?edit=1`} className="rounded-pill border border-line-strong px-4 py-2 text-[12.5px] font-medium uppercase text-ink-soft hover:border-blue hover:text-blue">Edit</Link> : null}
        </>} />
      {editing ? (
        <Card><CardBody><SkuForm sku={s} vendors={vendors} /></CardBody></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="On hand (network)" value={num(s.qty)} tone={s.qty <= 0 ? "bad" : s.qty < s.reorderLevel ? "warn" : "ok"} sub={`Reorder at ${num(s.reorderLevel)} · reorder qty ${num(s.reorderQty)}`} />
            <KpiCard label="On order" value={num(s.onOrder)} sub={`${s.openLines.length} open PO line${s.openLines.length === 1 ? "" : "s"}`} />
            <KpiCard label="Stock value" value={money(s.qty * s.unitCost)} />
            <KpiCard label="Days of cover" value={s.reorderLevel ? `${Math.round((s.qty / Math.max(1, s.reorderLevel)) * s.leadTimeDays)}` : "—"} sub="Relative to lead time" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-5">
              <Card>
                <CardHeader title="Stock by depot" />
                <Table>
                  <thead><tr><Th>Depot</Th><Th>Country</Th><Th right>On hand</Th><Th>Updated</Th></tr></thead>
                  <tbody>
                    {s.warehouses.map((w) => { const lvl = s.stock.find((l) => l.warehouseId === w.id); return (
                      <Tr key={w.id}><Td>{w.name} <span className="text-ink-faint">({w.code})</span></Td><Td>{w.country}</Td><Td right className={!lvl || lvl.qty === 0 ? "text-ink-faint" : ""}>{num(lvl?.qty ?? 0)}</Td><Td className="text-ink-faint">{lvl ? dateTime(lvl.updatedAt) : "—"}</Td></Tr>
                    ); })}
                  </tbody>
                </Table>
              </Card>
              {can(user.role, "stock.adjust") ? (
                <Card><CardHeader title="Adjust stock" subtitle="Every change is recorded as a movement" /><CardBody><AdjustForm skuId={s.id} warehouses={s.warehouses} /></CardBody></Card>
              ) : null}
              <Card>
                <CardHeader title="Open purchase orders" />
                <Table>
                  <thead><tr><Th>PO</Th><Th>Status</Th><Th right>Ordered</Th><Th right>Received</Th></tr></thead>
                  <tbody>
                    {s.openLines.map((l) => <Tr key={l.poId}><Td mono><Link href={`/purchase-orders/${l.poId}`} className="text-blue hover:underline">{l.poNumber}</Link></Td><Td><PoStatusBadge status={l.status} /></Td><Td right>{num(l.qty)}</Td><Td right>{num(l.received)}</Td></Tr>)}
                    {s.openLines.length === 0 ? <tr><Td colSpan={4} className="text-center text-ink-faint">Nothing on order.</Td></tr> : null}
                  </tbody>
                </Table>
              </Card>
            </div>
            <Card>
              <CardHeader title="Recent movements" />
              <Table>
                <thead><tr><Th>When</Th><Th>Reason</Th><Th right>Δ</Th><Th>Note</Th></tr></thead>
                <tbody>
                  {s.movements.map((m) => <Tr key={m.id}><Td className="whitespace-nowrap text-ink-faint">{dateTime(m.createdAt)}</Td><Td>{m.reason}</Td><Td right className={m.delta < 0 ? "text-bad-fg" : "text-ok-fg"}>{m.delta > 0 ? "+" : ""}{num(m.delta)}</Td><Td className="text-ink-soft">{m.note}</Td></Tr>)}
                </tbody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
