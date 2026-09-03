import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { VendorForm } from "@/components/vendors/vendor-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "New vendor" };

export default async function NewVendorPage() {
  await requireAction("vendor.manage");
  return (
    <>
      <PageHeader eyebrow="Supply base" title="Add a vendor" />
      <Card><CardBody><VendorForm /></CardBody></Card>
    </>
  );
}
