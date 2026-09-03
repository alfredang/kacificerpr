import { Bot, CheckCircle2, CircleDot, FileText, Mail, PackageCheck, Send, ShoppingCart, XCircle, ListChecks, Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { dateTime } from "@/lib/format";
import type { PoEvent } from "@/db/schema";

const ICON: Record<string, { icon: typeof Send; cls: string }> = {
  created: { icon: CircleDot, cls: "bg-wash text-ink-soft" },
  edited: { icon: Pencil, cls: "bg-wash text-ink-soft" },
  submitted: { icon: Send, cls: "bg-accent-tint text-blue" },
  approval_email_sent: { icon: Mail, cls: "bg-accent-tint text-blue" },
  approved: { icon: CheckCircle2, cls: "bg-ok-bg text-ok-fg" },
  rejected: { icon: XCircle, cls: "bg-bad-bg text-bad-fg" },
  cancelled: { icon: XCircle, cls: "bg-bad-bg text-bad-fg" },
  reopened: { icon: RotateCcw, cls: "bg-wash text-ink-soft" },
  ordered: { icon: ShoppingCart, cls: "bg-tint text-sky" },
  received: { icon: PackageCheck, cls: "bg-ok-bg text-ok-fg" },
  received_partial: { icon: PackageCheck, cls: "bg-warn-bg text-warn-fg" },
  closed: { icon: CheckCircle2, cls: "bg-wash text-ink-soft" },
  invoice_linked: { icon: FileText, cls: "bg-accent-tint text-blue" },
  asana_task_created: { icon: ListChecks, cls: "bg-tint text-sky" },
  asana_task_completed: { icon: ListChecks, cls: "bg-ok-bg text-ok-fg" },
  asana_failed: { icon: ListChecks, cls: "bg-warn-bg text-warn-fg" },
  agent_proposal: { icon: Bot, cls: "bg-tint text-sky" },
};

export function EventTimeline({ events, className, compact }: { events: (Pick<PoEvent, "id" | "type" | "message" | "actorLabel" | "createdAt"> & { poNumber?: string; poId?: string })[]; className?: string; compact?: boolean }) {
  return (
    <ol className={cn("relative ml-3 border-l border-line-strong", className)}>
      {events.map((e) => {
        const { icon: Icon, cls } = ICON[e.type] ?? { icon: CircleDot, cls: "bg-wash text-ink-soft" };
        return (
          <li key={e.id} className={cn("relative pl-7", compact ? "pb-4" : "pb-6")}>
            <span className={cn("absolute -left-[13px] top-0 flex size-6 items-center justify-center rounded-full ring-4 ring-white", cls)}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="text-[13.5px] text-ink">
              {e.poNumber ? <span className="mr-1 font-medium text-blue">{e.poNumber}</span> : null}
              <span className="font-medium">{e.type.replace(/_/g, " ")}</span>
              {e.message ? <span className="text-ink-soft"> — {e.message}</span> : null}
            </p>
            <p className="text-[12px] text-ink-faint">
              {e.actorLabel} · {dateTime(e.createdAt)}
            </p>
          </li>
        );
      })}
      {events.length === 0 ? <li className="pl-7 text-[13px] text-ink-faint">No events yet.</li> : null}
    </ol>
  );
}
