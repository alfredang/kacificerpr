import type { Metadata } from "next";
import Link from "next/link";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listPos } from "@/server/services/po";
import { Button } from "@/components/ui/button";
import { PoStatusBadge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/misc";
import { Card } from "@/components/ui/card";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { PO_STATUSES, PO_STATUS_LABEL, type PoStatus } from "@/lib/constants";
import { dateShort, money } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Purchase orders" };
export const dynamic = "force-dynamic";

export default async function PoListPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAction("po.view");
  const params = await searchParams;
  const statusParam = sp(params.status);
  const q = sp(params.q);
  const status = statusParam === "open" ? (["pending_approval", "approved", "ordered"] as PoStatus[]) : PO_STATUSES.includes(statusParam as PoStatus) ? (statusParam as PoStatus) : undefined;
  const pos = await listPos({ status, q });
  const tabs: { key: string; label: string }[] = [{ key: "", label: "All" }, { key: "open", label: "Open" }, ...PO_STATUSES.map((s) => ({ key: s, label: PO_STATUS_LABEL[s] }))];

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase orders"
        subtitle="Raise a PO, route it to a manager for approval, order, receive and close."
        actions={can(user.role, "po.create") ? <Button href="/purchase-orders/new">New purchase order</Button> : null}
      />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/purchase-orders?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}` : `/purchase-orders${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", (statusParam ?? "") === t.key ? "border-blue text-blue" : "border-transparent text-ink-soft hover:text-ink")}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {q ? <p className="mb-3 text-[13px] text-ink-soft">Search: “{q}” · <Link href="/purchase-orders" className="text-blue hover:underline">clear</Link></p> : null}
      <Card>
        {pos.length === 0 ? (
          <div className="p-6">
            <EmptyState title="No purchase orders here" action={can(user.role, "po.create") ? <Button href="/purchase-orders/new" variant="secondary">Raise the first one</Button> : null}>
              Nothing matches this filter.
            </EmptyState>
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>PO</Th>
                <Th>Vendor</Th>
                <Th>Depot</Th>
                <Th>Requester</Th>
                <Th>Status</Th>
                <Th>Needed by</Th>
                <Th right>Total</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <Tr key={po.id}>
                  <Td mono>
                    <Link href={`/purchase-orders/${po.id}`} className="font-medium text-blue hover:underline">
                      {po.poNumber}
                    </Link>
                  </Td>
                  <Td>{po.vendor.name}</Td>
                  <Td>{po.warehouse.code}</Td>
                  <Td>{po.requester?.name ?? "—"}</Td>
                  <Td>
                    <PoStatusBadge status={po.status} />
                  </Td>
                  <Td>{dateShort(po.neededBy)}</Td>
                  <Td right>{money(po.total)}</Td>
                  <Td className="text-ink-faint">{dateShort(po.createdAt)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
