import type { Metadata } from "next";
import Link from "next/link";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listInvoices } from "@/server/services/invoice";
import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { INVOICE_STATUSES, INVOICE_STATUS_LABEL, type InvoiceStatus } from "@/lib/constants";
import { dateShort, money } from "@/lib/format";
import { sp, type SearchParams } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAction("invoice.view");
  const params = await searchParams;
  const status = sp(params.status);
  const q = sp(params.q);
  const rows = await listInvoices({ status: INVOICE_STATUSES.includes(status as InvoiceStatus) ? (status as InvoiceStatus) : undefined, q });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader eyebrow="Accounts payable" title="Vendor invoices" subtitle="Record invoices against purchase orders; the 3-way match checks PO, goods receipt and price before payment." actions={can(user.role, "invoice.create") ? <Button href="/invoices/new">Record invoice</Button> : null} />
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {[{ key: "", label: "All" }, ...INVOICE_STATUSES.map((s) => ({ key: s, label: INVOICE_STATUS_LABEL[s] }))].map((t) => (
          <Link key={t.key} href={t.key ? `/invoices?status=${t.key}` : "/invoices"} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", (status ?? "") === t.key ? "border-blue text-blue" : "border-transparent text-ink-soft hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </div>
      <Card>
        {rows.length === 0 ? (
          <div className="p-6"><EmptyState title="No invoices match">Try another status.</EmptyState></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Vendor</Th>
                <Th>PO</Th>
                <Th>Status</Th>
                <Th>Match</Th>
                <Th>Due</Th>
                <Th right>Total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const m = i.match;
                const all = m && m.poMatch && m.qtyMatch && m.receiptMatch && m.priceMatch;
                const overdue = i.dueAt && i.dueAt < today && !["paid", "draft"].includes(i.status);
                return (
                  <Tr key={i.id}>
                    <Td mono><Link href={`/invoices/${i.id}`} className="font-medium text-blue hover:underline">{i.invoiceNumber}</Link></Td>
                    <Td>{i.vendor.name}</Td>
                    <Td mono>{i.po ? <Link href={`/purchase-orders/${i.po.id}`} className="text-blue hover:underline">{i.po.poNumber}</Link> : "—"}</Td>
                    <Td><InvoiceStatusBadge status={i.status} /></Td>
                    <Td>
                      {m ? (
                        <span className="inline-flex gap-0.5" title={m.notes.join(" ")}>
                          {[m.poMatch, m.qtyMatch, m.receiptMatch, m.priceMatch].map((ok, k) => (
                            <span key={k} className={cn("size-2.5 rounded-full", ok ? "bg-ok-fg" : "bg-bad-fg")} />
                          ))}
                          <span className="ml-1 text-[12px] text-ink-soft">{all ? "3-way OK" : `${[m.poMatch, m.qtyMatch, m.receiptMatch, m.priceMatch].filter(Boolean).length}/4`}</span>
                        </span>
                      ) : <span className="text-[12px] text-ink-faint">not run</span>}
                    </Td>
                    <Td className={overdue ? "text-bad-fg" : ""}>{dateShort(i.dueAt)}{overdue ? " · overdue" : ""}</Td>
                    <Td right>{money(i.total)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
