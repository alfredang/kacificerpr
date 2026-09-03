import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listSkus, listWarehouses, lowStockList, vendorsForPicker } from "@/server/services/sku";
import { createPoAction } from "@/server/actions/po";
import { PoForm } from "@/components/po/po-form";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody } from "@/components/ui/card";
import { sp, type SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "New purchase order" };
export const dynamic = "force-dynamic";

export default async function NewPoPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAction("po.create");
  const params = await searchParams;
  const [vendors, warehouses, skus] = await Promise.all([vendorsForPicker(), listWarehouses(), listSkus()]);
  const fromVendor = sp(params.vendor);
  let initial: React.ComponentProps<typeof PoForm>["initial"] | undefined;
  if (sp(params.from) === "low-stock" && fromVendor) {
    const low = (await lowStockList()).filter((l) => l.vendor?.id === fromVendor && l.suggestedQty > 0);
    initial = {
      vendorId: fromVendor,
      warehouseId: sp(params.warehouse) ?? warehouses.find((w) => w.code === "SIN-HQ")?.id,
      source: "low_stock",
      notes: "Generated from the low-stock list.",
      lines: low.map((l) => ({ skuId: l.id, description: l.name, qty: l.suggestedQty, unitCost: l.unitCost })),
    };
  }
  return (
    <>
      <PageHeader eyebrow="Procurement" title="New purchase order" subtitle="Pick the vendor, add SKUs (the preferred vendor's catalogue is suggested), then save as draft or submit straight to a manager." />
      <Card>
        <CardBody>
          <PoForm
            vendors={vendors}
            warehouses={warehouses}
            skus={skus.map((s) => ({ id: s.id, sku: s.sku, name: s.name, unitCost: s.unitCost, preferredVendorId: s.preferredVendorId, qty: s.qty, reorderLevel: s.reorderLevel }))}
            initial={initial}
            action={createPoAction}
            canSubmit={can(user.role, "po.submit")}
          />
        </CardBody>
      </Card>
    </>
  );
}
