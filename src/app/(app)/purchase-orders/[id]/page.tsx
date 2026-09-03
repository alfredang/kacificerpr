import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getPo } from "@/server/services/po";
import { listSkus, listWarehouses, vendorsForPicker } from "@/server/services/sku";
import { updatePoAction } from "@/server/actions/po";
import { PoStepper } from "@/components/po/stepper";
import { EventTimeline } from "@/components/po/event-timeline";
import { PoActionsPanel } from "@/components/po/actions-panel";
import { PoForm } from "@/components/po/po-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InvoiceStatusBadge, PoStatusBadge } from "@/components/ui/badge";
import { Alert, PageHeader, Stat } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { allowedActions, EDITABLE_STATUSES } from "@/lib/po-status";
import { dateShort, dateTime, money, num } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const po = await getPo(id);
  return { title: po ? po.poNumber : "Purchase order" };
}

export default async function PoDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const user = await requireAction("po.view");
  const { id } = await params;
  const po = await getPo(id);
  if (!po) notFound();
  const editing = sp((await searchParams).edit) === "1" && EDITABLE_STATUSES.includes(po.status) && can(user.role, "po.edit");
  const actions = allowedActions(po.status, user.role).filter((a) => {
    if (a === "cancel" && user.role === "requester" && po.requesterId !== user.id) return false;
    return true;
  });
  const received = po.lines.reduce((s, l) => s + l.qtyReceived, 0);
  const ordered = po.lines.reduce((s, l) => s + l.qty, 0);

  if (editing) {
    const [vendors, warehouses, skus] = await Promise.all([vendorsForPicker(), listWarehouses(), listSkus()]);
    return (
      <>
        <PageHeader eyebrow="Procurement" title={`Edit ${po.poNumber}`} actions={<Link href={`/purchase-orders/${po.id}`} className="text-[13px] text-blue hover:underline">Cancel editing</Link>} />
        <Card>
          <CardBody>
            <PoForm
              vendors={vendors}
              warehouses={warehouses}
              skus={skus.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitCost: s.unitCost, preferredVendorId: s.preferredVendorId, qty: s.qty, reorderLevel: s.reorderLevel }))}
              initial={{ vendorId: po.vendorId, warehouseId: po.warehouseId, neededBy: po.neededBy, notes: po.notes, lines: po.lines.map((l) => ({ skuId: l.skuId, description: l.description, qty: l.qty, unitCost: l.unitCost })) }}
              action={updatePoAction.bind(null, po.id)}
              canSubmit={can(user.role, "po.submit")}
              submitLabel="Save changes"
            />
          </CardBody>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Purchase order"
        title={
          <span className="flex items-center gap-3">
            {po.poNumber} <PoStatusBadge status={po.status} />
          </span>
        }
        subtitle={`${po.vendor.name} → ${po.warehouse.name} · raised by ${po.requester?.name ?? "—"} on ${dateShort(po.createdAt)}`}
        actions={
          <>
            {EDITABLE_STATUSES.includes(po.status) && can(user.role, "po.edit") ? (
              <Link href={`/purchase-orders/${po.id}?edit=1`} className="rounded-pill border border-line-strong px-4 py-2 text-[12.5px] font-medium uppercase text-ink-soft hover:border-blue hover:text-blue">
                Edit lines
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="mb-5">
        <CardBody className="py-6">
          <PoStepper status={po.status} />
        </CardBody>
      </Card>

      {po.status === "pending_approval" && can(user.role, "po.approve") ? (
        <Alert tone="warn" title="Waiting for your decision" className="mb-5">
          Approve or reject below, or use the one-click links in the approval email. Either path records who decided and when.
        </Alert>
      ) : null}
      {po.status === "rejected" && po.decisionNote ? (
        <Alert tone="bad" title="Rejected" className="mb-5">
          {po.decisionNote} — {po.approver?.name ?? "manager"}, {dateTime(po.decidedAt)}
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Lines" subtitle={`${po.lines.length} line${po.lines.length === 1 ? "" : "s"} · ${num(received)}/${num(ordered)} units received`} />
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>SKU</Th>
                  <Th>Description</Th>
                  <Th right>Qty</Th>
                  <Th right>Received</Th>
                  <Th right>Unit cost</Th>
                  <Th right>Total</Th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l) => (
                  <Tr key={l.id}>
                    <Td className="text-ink-faint">{l.lineNo}</Td>
                    <Td mono>{l.sku ? <Link href={`/skus/${l.sku.sku}`} className="text-blue hover:underline">{l.sku.sku}</Link> : "—"}</Td>
                    <Td>{l.description}</Td>
                    <Td right>{num(l.qty)}</Td>
                    <Td right className={l.qtyReceived >= l.qty && l.qty > 0 ? "text-ok-fg" : ""}>{num(l.qtyReceived)}</Td>
                    <Td right>{money(l.unitCost)}</Td>
                    <Td right>{money(l.lineTotal)}</Td>
                  </Tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={6} right className="font-semibold">Total</Td>
                  <Td right className="text-[15px] font-bold text-blue">{money(po.total)}</Td>
                </tr>
              </tfoot>
            </Table>
          </Card>

          {actions.length ? (
            <Card>
              <CardHeader title="Actions" subtitle="Your role decides which steps you can take" />
              <CardBody>
                <PoActionsPanel poId={po.id} actions={actions} lines={po.lines.map((l) => ({ id: l.id, description: l.description, qty: l.qty, qtyReceived: l.qtyReceived }))} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Invoices" subtitle="Vendor invoices linked to this PO" actions={can(user.role, "invoice.create") ? <Link href={`/invoices/new?po=${po.id}`} className="text-[12.5px] text-blue hover:underline">Record invoice</Link> : null} />
            {po.invoices.length === 0 ? (
              <CardBody className="text-[13.5px] text-ink-faint">No invoice yet.</CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Status</Th>
                    <Th>Due</Th>
                    <Th right>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {po.invoices.map((i) => (
                    <Tr key={i.id}>
                      <Td mono><Link href={`/invoices/${i.id}`} className="text-blue hover:underline">{i.invoiceNumber}</Link></Td>
                      <Td><InvoiceStatusBadge status={i.status} /></Td>
                      <Td>{dateShort(i.dueAt)}</Td>
                      <Td right>{money(i.total)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="grid grid-cols-2 gap-4">
              <Stat label="Vendor" value={<Link href={`/vendors/${po.vendorId}`} className="text-blue hover:underline">{po.vendor.name}</Link>} />
              <Stat label="Depot" value={po.warehouse.name} />
              <Stat label="Requester" value={po.requester?.name ?? "—"} />
              <Stat label="Approver" value={po.approver?.name ?? (po.status === "pending_approval" ? "Awaiting manager" : "—")} />
              <Stat label="Needed by" value={dateShort(po.neededBy)} />
              <Stat label="Source" value={po.source.replace("_", " ")} />
              <Stat label="Submitted" value={dateTime(po.submittedAt)} />
              <Stat label="Decided" value={dateTime(po.decidedAt)} />
              <Stat label="Asana task" value={po.asanaTaskGid ? <Link href="/asana" className="text-blue hover:underline">{po.asanaTaskGid.startsWith("mock") ? "demo task" : po.asanaTaskGid}</Link> : "—"} />
              <Stat label="Lead time" value={`${po.vendor.leadTimeDays} days`} />
            </CardBody>
            {po.notes ? <CardBody className="border-t border-line text-[13.5px] text-ink-soft">{po.notes}</CardBody> : null}
          </Card>
          <Card>
            <CardHeader title="Timeline" subtitle="Every step, who took it and when" />
            <CardBody>
              <EventTimeline events={po.events} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
