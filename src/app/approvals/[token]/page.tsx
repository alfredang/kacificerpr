import Image from "next/image";
import Link from "next/link";
import { peekApprovalToken } from "@/server/services/po";
import { money } from "@/lib/format";
import { Alert } from "@/components/ui/misc";
import { DecisionForm } from "./decision-form";

export const dynamic = "force-dynamic";

/* Public landing for the signed one-time links. GET only renders; the POST in
   DecisionForm is what commits the decision. */
export default async function ApprovalPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const done = typeof sp.done === "string" ? sp.done : null;
  if (done === "approve" || done === "reject") {
    return (
      <div className="min-h-screen bg-tint/60">
        <header className="orbit-band px-6 py-5">
          <Image src="/kacific-logo.png" alt="Kacific" width={140} height={50} className="relative brightness-0 invert" />
        </header>
        <main className="mx-auto max-w-2xl space-y-4 px-6 py-10">
          <h1 className="text-[26px] font-semibold">{String(sp.po ?? "Purchase order")} {done === "approve" ? "approved" : "rejected"}</h1>
          <Alert tone="ok" title={`${String(sp.po ?? "The purchase order")} ${done === "approve" ? "approved" : "rejected"}`}>
            The requester has been notified and the decision is on the purchase order timeline.
          </Alert>
          <Link href={`/purchase-orders/${String(sp.id ?? "")}`} className="text-[13.5px] text-blue hover:underline">
            Open the purchase order in the ERP
          </Link>
        </main>
      </div>
    );
  }
  const r = await peekApprovalToken(token);
  return (
    <div className="min-h-screen bg-tint/60">
      <header className="orbit-band px-6 py-5">
        <Image src="/kacific-logo.png" alt="Kacific" width={140} height={50} className="relative brightness-0 invert" />
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">
        {!r.ok ? (
          <div className="space-y-4">
            <h1 className="text-[26px] font-semibold">This link cannot be used</h1>
            <Alert tone="warn">
              {r.reason === "expired" ? "The approval link has expired." : r.reason === "used" ? "This purchase order has already been decided (or the link was already used)." : "The link is not valid."}
            </Alert>
            <Link href="/login" className="text-[13.5px] text-blue hover:underline">
              Sign in to the ERP instead
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <p className="text-[11.5px] font-medium uppercase text-sky">One-click {r.action === "approve" ? "approval" : "rejection"}</p>
              <h1 className="mt-1 text-[26px] font-semibold">
                {r.action === "approve" ? "Approve" : "Reject"} {r.po.poNumber}?
              </h1>
              <p className="mt-1 text-[14px] text-ink-soft">
                {r.po.requester?.name ?? "A requester"} · {r.po.vendor.name} → {r.po.warehouse.name} · <strong>{money(r.po.total)}</strong>
              </p>
            </div>
            {r.po.status !== "pending_approval" ? (
              <Alert tone="info">This purchase order is currently <strong>{r.po.status.replace("_", " ")}</strong>, so the link no longer applies.</Alert>
            ) : null}
            <div className="rounded-card border border-line bg-white shadow-card">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-ink-soft">
                    <th className="border-b-2 border-line-strong px-4 py-2">Item</th>
                    <th className="border-b-2 border-line-strong px-4 py-2 text-right">Qty</th>
                    <th className="border-b-2 border-line-strong px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {r.po.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="border-b border-line px-4 py-2">{l.description}</td>
                      <td className="border-b border-line px-4 py-2 text-right">{l.qty}</td>
                      <td className="border-b border-line px-4 py-2 text-right">{money(l.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.po.notes ? <p className="px-4 py-3 text-[13px] text-ink-soft">{r.po.notes}</p> : null}
            </div>
            <DecisionForm token={token} action={r.action} poId={r.po.id} disabled={r.po.status !== "pending_approval"} />
          </div>
        )}
      </main>
    </div>
  );
}
