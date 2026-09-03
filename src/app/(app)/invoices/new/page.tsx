import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { listPos } from "@/server/services/po";
import { vendorsForPicker } from "@/server/services/sku";
import { getDb } from "@/db";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { sp, type SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Record invoice" };
export const dynamic = "force-dynamic";

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAction("invoice.create");
  const params = await searchParams;
  const [vendors, pos] = await Promise.all([vendorsForPicker(), listPos({ status: ["ordered", "received", "closed", "approved"], limit: 100 })]);
  const lines = await getDb().query.purchaseOrderLines.findMany();
  const poOpts = pos.map((p) => ({ id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, lines: lines.filter((l) => l.poId === p.id).map((l) => ({ skuId: l.skuId, description: l.description, qty: l.qty, qtyReceived: l.qtyReceived, unitCost: l.unitCost })) }));
  return (
    <>
      <PageHeader eyebrow="Accounts payable" title="Record a vendor invoice" subtitle="Pick the purchase order to pre-fill the lines from what was received, then adjust to match the paper invoice." />
      <Card>
        <CardBody>
          <InvoiceForm vendors={vendors} pos={poOpts} initialPoId={sp(params.po)} />
        </CardBody>
      </Card>
    </>
  );
}
