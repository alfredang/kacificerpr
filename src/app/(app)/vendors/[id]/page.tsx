import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getVendor } from "@/server/services/vendor";
import { VendorForm } from "@/components/vendors/vendor-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InvoiceStatusBadge, PoStatusBadge } from "@/components/ui/badge";
import { KpiCard, PageHeader, Stat } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { dateShort, money, num } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vendor" };

export default async function VendorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireAction("vendor.view");
  const { id } = await params;
  const v = await getVendor(id);
  if (!v) notFound();
  const editing = sp((await searchParams).edit) === "1" && can(user.role, "vendor.manage");
  return (
    <>
      <PageHeader eyebrow={`Vendor ${v.code}`} title={v.name} subtitle={`${v.country} · ${v.contactName || "no contact"} · ${v.email || ""}`} actions={can(user.role, "vendor.manage") && !editing ? <Link href={`/vendors/${v.id}?edit=1`} className="rounded-pill border border-line-strong px-4 py-2 text-[12.5px] font-medium uppercase text-ink-soft hover:border-blue hover:text-blue">Edit</Link> : null} />
      {editing ? (
        <Card><CardBody><VendorForm vendor={v} /></CardBody></Card>
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Approved spend" value={money(v.spend)} />
            <KpiCard label="Lead time" value={`${v.leadTimeDays} d`} sub={`${v.paymentTermsDays}-day payment terms`} />
            <KpiCard label="Preferred SKUs" value={num(v.skus.length)} />
            <KpiCard label="Disputed invoices" value={num(v.disputed)} tone={v.disputed ? "bad" : "ok"} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div className="space-y-5">
              <Card>
                <CardHeader title="Purchase orders" />
                <Table>
                  <thead><tr><Th>PO</Th><Th>Depot</Th><Th>Status</Th><Th>Created</Th><Th right>Total</Th></tr></thead>
                  <tbody>
                    {v.pos.map((p) => (
                      <Tr key={p.id}><Td mono><Link href={`/purchase-orders/${p.id}`} className="text-blue hover:underline">{p.poNumber}</Link></Td><Td>{p.warehouse.code}</Td><Td><PoStatusBadge status={p.status} /></Td><Td>{dateShort(p.createdAt)}</Td><Td right>{money(p.total)}</Td></Tr>
                    ))}
                    {v.pos.length === 0 ? <tr><Td colSpan={5} className="text-center text-ink-faint">No purchase orders yet.</Td></tr> : null}
                  </tbody>
                </Table>
              </Card>
              <Card>
                <CardHeader title="Invoices" />
                <Table>
                  <thead><tr><Th>Invoice</Th><Th>Status</Th><Th>Due</Th><Th right>Total</Th></tr></thead>
                  <tbody>
                    {v.invoices.map((i) => (
                      <Tr key={i.id}><Td mono><Link href={`/invoices/${i.id}`} className="text-blue hover:underline">{i.invoiceNumber}</Link></Td><Td><InvoiceStatusBadge status={i.status} /></Td><Td>{dateShort(i.dueAt)}</Td><Td right>{money(i.total)}</Td></Tr>
                    ))}
                    {v.invoices.length === 0 ? <tr><Td colSpan={4} className="text-center text-ink-faint">No invoices yet.</Td></tr> : null}
                  </tbody>
                </Table>
              </Card>
            </div>
            <div className="space-y-5">
              <Card>
                <CardHeader title="Profile" />
                <CardBody className="grid grid-cols-2 gap-4">
                  <Stat label="Contact" value={v.contactName || "—"} />
                  <Stat label="Phone" value={v.phone || "—"} />
                  <Stat label="Currency" value={v.currency} />
                  <Stat label="Rating" value={<span className="text-warn-fg">{"★".repeat(v.rating)}</span>} />
                </CardBody>
                {v.notes ? <CardBody className="border-t border-line text-[13.5px] text-ink-soft">{v.notes}</CardBody> : null}
              </Card>
              <Card>
                <CardHeader title="Preferred SKUs" subtitle="Catalogue items sourced from this vendor" />
                <Table>
                  <thead><tr><Th>SKU</Th><Th>Item</Th><Th right>Unit cost</Th></tr></thead>
                  <tbody>
                    {v.skus.map((s) => (
                      <Tr key={s.id}><Td mono><Link href={`/skus/${s.sku}`} className="text-blue hover:underline">{s.sku}</Link></Td><Td>{s.name}</Td><Td right>{money(s.unitCost)}</Td></Tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
