import type { Metadata } from "next";
import Link from "next/link";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listCategories, listSkus } from "@/server/services/sku";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { money, num } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "SKUs & stock" };
export const dynamic = "force-dynamic";

export default async function SkusPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAction("sku.view");
  const params = await searchParams;
  const q = sp(params.q);
  const category = sp(params.category);
  const [skus, categories] = await Promise.all([listSkus({ q, category, includeInactive: true }), listCategories()]);
  const value = skus.reduce((s, k) => s + k.qty * k.unitCost, 0);
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="SKUs & stock" subtitle={`${skus.length} items · ${money(value)} on hand across all depots`} actions={can(user.role, "sku.manage") ? <Button href="/skus/new">Add SKU</Button> : null} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form><input name="q" defaultValue={q} placeholder="Search SKU or name…" aria-label="Search SKUs" className="w-64 rounded-pill border border-line-strong px-4 py-2 text-[13.5px] focus:border-blue focus:outline-none" />{category ? <input type="hidden" name="category" value={category} /> : null}</form>
        <div className="flex flex-wrap gap-1">
          <Link href="/skus" className={cn("rounded-pill px-3 py-1 text-[12.5px] font-medium", !category ? "bg-blue text-white" : "bg-wash text-ink-soft hover:bg-accent-tint")}>All</Link>
          {categories.map((c) => (
            <Link key={c} href={`/skus?category=${encodeURIComponent(c)}`} className={cn("rounded-pill px-3 py-1 text-[12.5px] font-medium", category === c ? "bg-blue text-white" : "bg-wash text-ink-soft hover:bg-accent-tint")}>{c}</Link>
          ))}
        </div>
      </div>
      <Card>
        <Table>
          <thead><tr><Th>SKU</Th><Th>Item</Th><Th>Category</Th><Th>Preferred vendor</Th><Th right>On hand</Th><Th right>On order</Th><Th right>Reorder at</Th><Th right>Unit cost</Th><Th>Status</Th></tr></thead>
          <tbody>
            {skus.map((s) => (
              <Tr key={s.id}>
                <Td mono><Link href={`/skus/${s.sku}`} className="font-medium text-blue hover:underline">{s.sku}</Link></Td>
                <Td>{s.name}{!s.isActive ? <span className="ml-2 text-[11px] uppercase text-ink-faint">inactive</span> : null}</Td>
                <Td>{s.category}</Td>
                <Td>{s.preferredVendor?.name ?? "—"}</Td>
                <Td right>{num(s.qty)}</Td>
                <Td right className="text-ink-soft">{num(s.onOrder)}</Td>
                <Td right>{num(s.reorderLevel)}</Td>
                <Td right>{money(s.unitCost)}</Td>
                <Td><StockBadge qty={s.qty} reorder={s.reorderLevel} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
