import type { Metadata } from "next";
import Link from "next/link";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { lowStockList } from "@/server/services/sku";
import { Button } from "@/components/ui/button";
import { StockBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { money, num } from "@/lib/format";

export const metadata: Metadata = { title: "Low stock" };
export const dynamic = "force-dynamic";

export default async function LowStockPage() {
  const user = await requireAction("lowstock.view");
  const items = await lowStockList();
  const byVendor = new Map<string, { vendor: NonNullable<(typeof items)[number]["vendor"]> | null; items: typeof items }>();
  for (const i of items) {
    const key = i.vendor?.id ?? "none";
    if (!byVendor.has(key)) byVendor.set(key, { vendor: i.vendor, items: [] });
    byVendor.get(key)!.items.push(i);
  }
  const toOrder = items.reduce((s, i) => s + i.suggestedQty * i.unitCost, 0);
  return (
    <>
      <PageHeader eyebrow="Replenishment" title="Low stock tracking" subtitle="SKUs whose network-wide on-hand quantity is below the reorder level. Suggested quantities cover the shortfall plus the reorder quantity, net of what is already on order." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <KpiCard label="SKUs below reorder" value={num(items.length)} tone={items.length ? "warn" : "ok"} />
        <KpiCard label="Out of stock" value={num(items.filter((i) => i.qty <= 0).length)} tone={items.some((i) => i.qty <= 0) ? "bad" : "ok"} />
        <KpiCard label="Suggested spend" value={money(toOrder)} sub={`${byVendor.size} vendor${byVendor.size === 1 ? "" : "s"}`} />
      </div>
      {items.length === 0 ? (
        <EmptyState title="Every SKU is above its reorder level">Nothing to replenish right now.</EmptyState>
      ) : (
        <div className="space-y-5">
          {[...byVendor.values()].map(({ vendor, items: group }) => (
            <Card key={vendor?.id ?? "none"}>
              <CardHeader
                title={vendor ? vendor.name : "No preferred vendor"}
                subtitle={vendor ? `${group.length} SKU${group.length === 1 ? "" : "s"} · ${vendor.leadTimeDays}-day lead time · ${money(group.reduce((s, i) => s + i.suggestedQty * i.unitCost, 0))} suggested` : "Assign a preferred vendor on each SKU to enable one-click POs"}
                actions={vendor && can(user.role, "po.create") && group.some((g) => g.suggestedQty > 0) ? <Button href={`/purchase-orders/new?from=low-stock&vendor=${vendor.id}`} size="sm">Generate PO</Button> : null}
              />
              <Table>
                <thead><tr><Th>SKU</Th><Th>Item</Th><Th right>On hand</Th><Th right>Reorder at</Th><Th right>On order</Th><Th right>Suggest</Th><Th right>Est. cost</Th><Th>Depots</Th><Th>Status</Th></tr></thead>
                <tbody>
                  {group.map((i) => (
                    <Tr key={i.id}>
                      <Td mono><Link href={`/skus/${i.sku}`} className="text-blue hover:underline">{i.sku}</Link></Td>
                      <Td>{i.name}</Td>
                      <Td right>{num(i.qty)}</Td>
                      <Td right>{num(i.reorderLevel)}</Td>
                      <Td right className="text-ink-soft">{num(i.onOrder)}</Td>
                      <Td right className="font-semibold">{num(i.suggestedQty)}</Td>
                      <Td right>{money(i.suggestedQty * i.unitCost)}</Td>
                      <Td className="text-[12px] text-ink-soft">{i.perWarehouse.filter((w) => w.qty > 0).map((w) => `${w.code} ${w.qty}`).join(" · ") || "none"}</Td>
                      <Td><StockBadge qty={i.qty} reorder={i.reorderLevel} /></Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
