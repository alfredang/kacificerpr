import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { vendorsForPicker } from "@/server/services/sku";
import { SkuForm } from "@/components/skus/sku-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "New SKU" };

export default async function NewSkuPage() {
  await requireAction("sku.manage");
  const vendors = await vendorsForPicker();
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Add a SKU" />
      <Card><CardBody><SkuForm vendors={vendors} /></CardBody></Card>
    </>
  );
}
