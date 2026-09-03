import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { asanaBoard } from "@/server/services/asana-board";
import { Button } from "@/components/ui/button";
import { Badge, PoStatusBadge } from "@/components/ui/badge";
import { Alert, PageHeader } from "@/components/ui/misc";
import { dateShort, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PoStatus } from "@/lib/constants";

export const metadata: Metadata = { title: "Asana" };
export const dynamic = "force-dynamic";

const HEAD: Record<string, string> = { warn: "border-t-warn-fg", blue: "border-t-blue", sky: "border-t-sky", ok: "border-t-ok-fg", neutral: "border-t-orbit-grey" };

export default async function AsanaPage() {
  const user = await requireAction("asana.view");
  const { columns, mode, integration } = await asanaBoard();
  const total = columns.reduce((s, c) => s + c.cards.length, 0);
  return (
    <>
      <PageHeader
        eyebrow="Integration"
        title="Asana approval board"
        subtitle="Every submitted purchase order becomes an Asana task; approving or rejecting it here or by email completes the task. Columns mirror the PO lifecycle."
        actions={
          <>
            <Badge tone={mode === "live" ? "ok" : "warn"}>{mode === "live" ? "Live · connected" : "Demo mode · sample tasks"}</Badge>
            {can(user.role, "settings.manage") ? <Button href="/settings/integrations" variant="secondary" size="sm">Configure</Button> : null}
          </>
        }
      />
      {mode === "demo" ? (
        <Alert tone="info" className="mb-5" title="Showing sample tasks from the seeded purchase orders">
          Add an Asana personal access token and project GID under Settings → Integrations to see the real project. Task creation and completion already run through the same code path{integration.envFallback ? " (a PAT is present in the environment)" : ""}.
        </Alert>
      ) : null}
      <div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1100px] grid-cols-5 gap-4">
          {columns.map((col) => (
            <section key={col.key} className={cn("rounded-card border border-line border-t-4 bg-wash/70", HEAD[col.tone])} aria-label={col.label}>
              <header className="flex items-center justify-between px-3 py-2.5">
                <h2 className="text-[12.5px] font-semibold uppercase text-ink-soft">{col.label}</h2>
                <span className="rounded-pill bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ink-soft">{col.cards.length}</span>
              </header>
              <ul className="space-y-2 px-2 pb-2">
                {col.cards.map((c) => (
                  <li key={c.id} className="rounded-card border border-line bg-white p-3 shadow-card">
                    <p className="text-[13px] font-semibold leading-snug text-ink">{c.title}</p>
                    {c.poNumber ? (
                      <p className="mt-1 text-[12px] text-ink-soft">
                        <Link href={`/purchase-orders/${c.poId}`} className="font-medium text-blue hover:underline">{c.poNumber}</Link> · {c.vendor} · {money(c.total)}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-faint">
                      {c.status ? <PoStatusBadge status={c.status as PoStatus} /> : <Badge tone={c.completed ? "ok" : "neutral"}>{c.completed ? "Completed" : "Open"}</Badge>}
                      {c.dueOn ? <span>due {dateShort(c.dueOn)}</span> : null}
                      {c.requester ? <span>· {c.requester}</span> : null}
                      {c.url ? <a href={c.url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-blue hover:underline">Asana <ExternalLink className="size-3" /></a> : c.source === "demo" ? <span className="ml-auto uppercase">demo</span> : null}
                    </div>
                  </li>
                ))}
                {col.cards.length === 0 ? <li className="px-1 py-6 text-center text-[12px] text-ink-faint">Empty</li> : null}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">{total} task{total === 1 ? "" : "s"} · {mode === "live" ? "fetched from Asana" : "derived from seeded purchase orders"}</p>
    </>
  );
}
