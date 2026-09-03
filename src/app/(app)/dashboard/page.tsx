import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAction } from "@/server/auth/session";
import { dashboardData } from "@/server/services/dashboard";
import { getCompanySettings } from "@/server/services/settings";
import { BrandBarChart, CHART } from "@/components/charts/bar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/ui/misc";
import { StockBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { INVOICE_STATUS_LABEL } from "@/lib/constants";
import { ago, money, num } from "@/lib/format";
import { can } from "@/server/auth/rbac";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const INVOICE_COLORS: Record<string, string> = { draft: CHART.grey, received: CHART.sky, matched: CHART.blue, approved: CHART.wave, paid: CHART.ok, disputed: CHART.bad };

export default async function DashboardPage() {
  const user = await requireAction("dashboard.view");
  const [data, company] = await Promise.all([dashboardData(), getCompanySettings()]);
  const k = data.kpis;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="-mx-6 -mt-6 lg:-mx-8">
      <section className="orbit-band px-6 pb-24 pt-8 lg:px-8">
        <div className="relative">
          <p className="text-[11.5px] font-medium uppercase text-cyan">{company.name} · Network operations</p>
          <h1 className="mt-1 text-[30px] font-semibold">
            {greeting}, {user.name.split(" ")[0]}.
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] font-light text-white/85">
            {k.pendingApprovals > 0
              ? `${k.pendingApprovals} purchase order${k.pendingApprovals === 1 ? "" : "s"} waiting for approval, ${k.lowStock.n} SKU${k.lowStock.n === 1 ? "" : "s"} below reorder level across the network.`
              : `Nothing waiting for approval. ${k.lowStock.n} SKU${k.lowStock.n === 1 ? "" : "s"} below reorder level across the network.`}
          </p>
        </div>
      </section>

      <div className="relative z-10 -mt-16 px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Open purchase orders" value={num(k.openPos.n)} sub={`${money(k.openPos.value)} committed`} href="/purchase-orders?status=open" />
          <KpiCard label="Awaiting approval" value={num(k.pendingApprovals)} sub={k.pendingApprovals ? "Managers have been emailed" : "Inbox is clear"} tone={k.pendingApprovals ? "warn" : "ok"} href="/purchase-orders?status=pending_approval" />
          <KpiCard label="Approved spend, MTD" value={money(k.spendMtd.value)} sub={`${k.spendMtd.n} PO${k.spendMtd.n === 1 ? "" : "s"} this month`} />
          <KpiCard label="Invoices due in 7 days" value={num(k.invoicesDue.n)} sub={`${money(k.invoicesDue.value)} · ${k.invoicesDue.overdue} overdue`} tone={k.invoicesDue.overdue ? "bad" : "blue"} href="/invoices?status=approved" />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-3">
          <Card>
            <CardHeader title="PO spend by month" subtitle="Submitted and beyond, last six months" />
            <CardBody>
              <BrandBarChart data={data.spendByMonth.map((m) => ({ label: m.label, value: m.value, hint: `${m.n} PO${m.n === 1 ? "" : "s"}` }))} format="money" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Stock value by depot" subtitle="On-hand units × unit cost" />
            <CardBody>
              <BrandBarChart data={data.stockByWarehouse.map((w) => ({ label: w.code, value: w.value, hint: `${num(w.units)} units · ${w.name}` }))} format="money" color={CHART.sky} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Invoices by status" subtitle="Count of vendor invoices" />
            <CardBody>
              <BrandBarChart data={data.invoicesByStatus.map((s) => ({ label: INVOICE_STATUS_LABEL[s.status], value: s.n, color: INVOICE_COLORS[s.status], hint: money(s.value) }))} />
            </CardBody>
          </Card>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title="Low stock across the network"
              subtitle={`${k.lowStock.n} SKUs below reorder level · ${k.lowStock.outOfStock} out of stock`}
              actions={can(user.role, "po.create") ? <Button href="/low-stock" variant="secondary" size="sm">Generate POs</Button> : <Button href="/low-stock" variant="ghost" size="sm">View all</Button>}
            />
            <Table>
              <thead>
                <tr>
                  <Th>SKU</Th>
                  <Th>Item</Th>
                  <Th right>On hand</Th>
                  <Th right>Reorder at</Th>
                  <Th right>On order</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((l) => (
                  <Tr key={l.id}>
                    <Td mono>
                      <Link href={`/skus/${l.sku}`} className="text-blue hover:underline">
                        {l.sku}
                      </Link>
                    </Td>
                    <Td>{l.name}</Td>
                    <Td right>{num(l.qty)}</Td>
                    <Td right>{num(l.reorderLevel)}</Td>
                    <Td right>{num(l.onOrder)}</Td>
                    <Td>
                      <StockBadge qty={l.qty} reorder={l.reorderLevel} />
                    </Td>
                  </Tr>
                ))}
                {data.lowStock.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="text-center text-ink-faint">
                      Every SKU is above its reorder level.
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </Card>

          <Card>
            <CardHeader title="Recent activity" subtitle="Latest purchase-order events" actions={<Link href="/timeline" className="inline-flex items-center gap-1 text-[12.5px] text-blue hover:underline">Timeline <ArrowRight className="size-3.5" /></Link>} />
            <ul className="divide-y divide-line">
              {data.activity.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-3">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-ink">
                      <Link href={`/purchase-orders/${a.poId}`} className="font-medium text-blue hover:underline">
                        {a.poNumber}
                      </Link>{" "}
                      {a.message || a.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-[12px] text-ink-faint">
                      {a.actorLabel} · {ago(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
