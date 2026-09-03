import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getInvoice } from "@/server/services/invoice";
import { MatchPanel } from "@/components/invoices/match-panel";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InvoiceStatusBadge, PoStatusBadge } from "@/components/ui/badge";
import { PageHeader, Stat } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { dateShort, dateTime, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAction("invoice.view");
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const actions: string[] = [];
  if (inv.poId && ["received", "matched"].includes(inv.status) && can(user.role, "invoice.match")) actions.push("match");
  if (["matched", "received"].includes(inv.status) && can(user.role, "invoice.approve")) actions.push("approve");
  if (inv.status === "approved" && can(user.role, "invoice.pay")) actions.push("pay");
  if (["received", "matched", "approved"].includes(inv.status) && can(user.role, "invoice.edit")) actions.push("dispute");
  if (inv.status === "disputed" && can(user.role, "invoice.edit")) actions.push("reopen");

  return (
    <>
      <PageHeader
        eyebrow="Vendor invoice"
        title={<span className="flex items-center gap-3">{inv.invoiceNumber} <InvoiceStatusBadge status={inv.status} /></span>}
        subtitle={`${inv.vendor.name} · issued ${dateShort(inv.issuedAt)} · due ${dateShort(inv.dueAt)}`}
      />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Three-way match" subtitle="PO ↔ goods receipt ↔ invoice" />
            <CardBody>
              <MatchPanel invoice={{ id: inv.id, status: inv.status, match: inv.match, total: inv.total }} actions={actions} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Invoice lines" />
            <Table>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th right>Qty</Th>
                  <Th right>Unit price</Th>
                  <Th right>Total</Th>
                  {inv.po ? <><Th right>PO qty</Th><Th right>Received</Th><Th right>PO price</Th></> : null}
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l) => {
                  const p = inv.po?.lines.find((x) => (x.skuId && x.skuId === l.skuId) || x.description === l.description);
                  return (
                    <Tr key={l.id}>
                      <Td>{l.description}</Td>
                      <Td right>{num(l.qty)}</Td>
                      <Td right>{money(l.unitCost)}</Td>
                      <Td right>{money(l.lineTotal)}</Td>
                      {inv.po ? (
                        <>
                          <Td right className={p && l.qty > p.qty ? "text-bad-fg" : ""}>{p ? num(p.qty) : "—"}</Td>
                          <Td right className={p && l.qty > p.qtyReceived ? "text-bad-fg" : ""}>{p ? num(p.qtyReceived) : "—"}</Td>
                          <Td right className={p && Math.abs(p.unitCost - l.unitCost) > 0.005 ? "text-warn-fg" : ""}>{p ? money(p.unitCost) : "—"}</Td>
                        </>
                      ) : null}
                    </Tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={3} right className="font-semibold">Total</Td>
                  <Td right className="text-[15px] font-bold text-blue">{money(inv.total)}</Td>
                  {inv.po ? <Td colSpan={3} right className="text-ink-soft">PO total {money(inv.po.total)}</Td> : null}
                </tr>
              </tfoot>
            </Table>
          </Card>
        </div>
        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="grid grid-cols-2 gap-4">
              <Stat label="Vendor" value={<Link href={`/vendors/${inv.vendorId}`} className="text-blue hover:underline">{inv.vendor.name}</Link>} />
              <Stat label="Purchase order" value={inv.po ? <Link href={`/purchase-orders/${inv.po.id}`} className="text-blue hover:underline">{inv.po.poNumber}</Link> : "—"} />
              <Stat label="PO status" value={inv.po ? <PoStatusBadge status={inv.po.status} /> : "—"} />
              <Stat label="Depot" value={inv.po?.warehouse.name ?? "—"} />
              <Stat label="Received" value={dateTime(inv.receivedAt)} />
              <Stat label="Matched" value={dateTime(inv.matchedAt)} />
              <Stat label="Paid" value={dateTime(inv.paidAt)} />
              <Stat label="Payment terms" value={`${inv.vendor.paymentTermsDays} days`} />
            </CardBody>
            {inv.notes ? <CardBody className="whitespace-pre-line border-t border-line text-[13.5px] text-ink-soft">{inv.notes}</CardBody> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
