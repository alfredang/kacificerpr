import type { Metadata } from "next";
import Link from "next/link";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listVendors } from "@/server/services/vendor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { money, num } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Vendors" };
export const dynamic = "force-dynamic";

export default async function VendorsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAction("vendor.view");
  const q = sp((await searchParams).q);
  const vendors = await listVendors({ q, includeInactive: true });
  return (
    <>
      <PageHeader eyebrow="Supply base" title="Vendors" subtitle="Suppliers of terminals, RF, power, cabling and gateway spares — with lead times, terms and spend." actions={can(user.role, "vendor.manage") ? <Button href="/vendors/new">Add vendor</Button> : null} />
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Search vendors…" aria-label="Search vendors" className="w-full max-w-sm rounded-pill border border-line-strong px-4 py-2 text-[13.5px] focus:border-blue focus:outline-none" /></form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Code</Th><Th>Vendor</Th><Th>Country</Th><Th right>Lead time</Th><Th right>Terms</Th><Th>Rating</Th><Th right>SKUs</Th><Th right>Open POs</Th><Th right>Spend</Th>
            </tr>
          </thead>
          <tbody>
            {vendors.map((v) => (
              <Tr key={v.id}>
                <Td mono>{v.code}</Td>
                <Td><Link href={`/vendors/${v.id}`} className="font-medium text-blue hover:underline">{v.name}</Link>{!v.isActive ? <Badge tone="neutral" className="ml-2">inactive</Badge> : null}</Td>
                <Td>{v.country}</Td>
                <Td right>{v.leadTimeDays} d</Td>
                <Td right>{v.paymentTermsDays} d</Td>
                <Td className="text-warn-fg">{"★".repeat(v.rating)}<span className="text-line-strong">{"★".repeat(5 - v.rating)}</span></Td>
                <Td right>{num(v.skuCount)}</Td>
                <Td right>{num(v.openPos)}</Td>
                <Td right>{money(v.spend)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
