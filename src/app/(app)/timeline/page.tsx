import type { Metadata } from "next";
import { desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, poEvents, purchaseOrders } from "@/db/schema";
import { requireAction } from "@/server/auth/session";
import { invoiceStageCounts, poStageCounts } from "@/server/services/po";
import { lowStockList } from "@/server/services/sku";
import { P2PTimeline, type Stage } from "@/components/timeline/p2p-timeline";
import { EventTimeline } from "@/components/po/event-timeline";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { sp, type SearchParams } from "@/lib/types";

export const metadata: Metadata = { title: "Process timeline" };
export const dynamic = "force-dynamic";

export default async function TimelinePage({ searchParams }: { searchParams: SearchParams }) {
  await requireAction("timeline.view");
  const days = Number(sp((await searchParams).days) ?? 30) || 30;
  const [po, inv, low] = await Promise.all([poStageCounts(), invoiceStageCounts(), lowStockList()]);
  const db = getDb();
  const agentProposals = await db.$count(agentRuns, eq(agentRuns.status, "proposed"));
  const g = (k: string) => po[k] ?? { n: 0, value: 0 };
  const gi = (k: string) => inv[k] ?? { n: 0, value: 0 };
  const stages: Stage[] = [
    { key: "requisition", label: "Low stock", sub: "SKUs below reorder", href: "/low-stock", n: low.length, tone: low.length ? "warn" : "ok", agent: true },
    { key: "agent", label: "Agent proposals", sub: "awaiting review", href: "/agents", n: agentProposals, tone: "blue", agent: true },
    { key: "submit", label: "Draft POs", sub: "being prepared", href: "/purchase-orders?status=draft", n: g("draft").n, value: g("draft").value },
    { key: "approval", label: "Approval", sub: "manager decision", href: "/purchase-orders?status=pending_approval", n: g("pending_approval").n, value: g("pending_approval").value, tone: g("pending_approval").n ? "warn" : "blue", human: true },
    { key: "order", label: "Approved", sub: "to be ordered", href: "/purchase-orders?status=approved", n: g("approved").n, value: g("approved").value },
    { key: "receipt", label: "Ordered", sub: "awaiting delivery", href: "/purchase-orders?status=ordered", n: g("ordered").n, value: g("ordered").value },
    { key: "invoice", label: "Invoices in", sub: "received, unmatched", href: "/invoices?status=received", n: gi("received").n, value: gi("received").value },
    { key: "match", label: "3-way match", sub: "matched / disputed", href: "/invoices?status=matched", n: gi("matched").n + gi("disputed").n, value: gi("matched").value + gi("disputed").value, tone: gi("disputed").n ? "bad" : "blue", human: true },
    { key: "payment", label: "Approved to pay", sub: "finance release", href: "/invoices?status=approved", n: gi("approved").n, value: gi("approved").value, human: true },
    { key: "closed", label: "Paid & closed", sub: "cycle complete", href: "/invoices?status=paid", n: gi("paid").n, value: gi("paid").value, tone: "ok" },
  ];

  const since = new Date();
  since.setDate(since.getDate() - days);
  const events = await db
    .select({ id: poEvents.id, type: poEvents.type, message: poEvents.message, actorLabel: poEvents.actorLabel, createdAt: poEvents.createdAt, poId: poEvents.poId, poNumber: purchaseOrders.poNumber })
    .from(poEvents)
    .innerJoin(purchaseOrders, eq(purchaseOrders.id, poEvents.poId))
    .where(gte(poEvents.createdAt, since))
    .orderBy(desc(poEvents.createdAt))
    .limit(80);

  return (
    <>
      <PageHeader eyebrow="Procure to pay" title="Process timeline" subtitle="The end-to-end flow from a low-stock signal to a paid invoice, with live counts at every stage. Amber rings are the human-in-the-loop gates; blue rings are where the DeepSeek agents assist." />
      <Card className="mb-6">
        <CardBody className="py-6">
          <P2PTimeline stages={stages} />
        </CardBody>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader title="How a purchase order moves" subtitle="Each transition is enforced by the state machine and recorded on the PO's own timeline" />
          <CardBody>
            <ol className="space-y-3 text-[13.5px]">
              {[
                ["1", "Signal", "A depot drops below reorder level, a requester raises a need, or the reorder agent proposes a draft from the low-stock list."],
                ["2", "Draft", "Vendor, depot and SKU lines with the preferred vendor's prices. Editable until submitted."],
                ["3", "Approval — human gate", "Managers get an email with single-use approve / reject links and an Asana task. The decision, who made it and how (email, app, API) is recorded."],
                ["4", "Order & receive", "Procurement sends the PO; goods are received per line into the depot and stock moves in the same transaction."],
                ["5", "Invoice & 3-way match — human gate", "Finance records the vendor invoice; the match checks PO, receipt and price tolerance. Mismatches are disputed with a reason."],
                ["6", "Pay & close", "Finance approves and pays; the PO closes. Webhooks fire at every step for downstream systems."],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue text-[11px] font-semibold text-white">{n}</span>
                  <div><p className="font-semibold">{t}</p><p className="text-ink-soft">{d}</p></div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`Activity, last ${days} days`} subtitle={`${events.length} events across all purchase orders`} actions={<div className="flex gap-1 text-[12px]">{[7, 30, 90].map((d) => <a key={d} href={`/timeline?days=${d}`} className={`rounded-pill px-2.5 py-1 ${d === days ? "bg-blue text-white" : "bg-wash text-ink-soft"}`}>{d}d</a>)}</div>} />
          <CardBody className="max-h-[720px] overflow-y-auto">
            <EventTimeline events={events} compact />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
