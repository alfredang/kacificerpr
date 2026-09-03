import Link from "next/link";
import { Bot, CheckCircle2, ClipboardList, FileText, Landmark, PackageCheck, Scale, Send, Store, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { money, num } from "@/lib/format";

export type Stage = { key: string; label: string; sub: string; href: string; n: number; value?: number; tone?: "blue" | "warn" | "ok" | "bad"; human?: boolean; agent?: boolean };

const ICONS: Record<string, typeof Send> = { requisition: ClipboardList, submit: Send, approval: UserCheck, order: Store, receipt: PackageCheck, invoice: FileText, match: Scale, payment: Landmark, closed: CheckCircle2, agent: Bot };

/* Horizontal procure-to-pay flow with live counts per stage. The approval and
   match gates are the human-in-the-loop stops and are drawn as such. */
export function P2PTimeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-[980px] items-stretch gap-0">
        {stages.map((s, i) => {
          const Icon = ICONS[s.key] ?? ClipboardList;
          const tone = s.tone ?? "blue";
          const ring = { blue: "border-blue text-blue", warn: "border-warn-fg text-warn-fg", ok: "border-ok-fg text-ok-fg", bad: "border-bad-fg text-bad-fg" }[tone];
          const bg = { blue: "bg-accent-tint", warn: "bg-warn-bg", ok: "bg-ok-bg", bad: "bg-bad-bg" }[tone];
          return (
            <li key={s.key} className="relative flex flex-1 flex-col items-center px-1 text-center">
              {i > 0 ? <span aria-hidden className="absolute left-[-50%] right-[50%] top-6 h-0.5 bg-line-strong" /> : null}
              {i < stages.length - 1 ? <span aria-hidden className="absolute left-[50%] right-[-50%] top-6 h-0.5 bg-line-strong" /> : null}
              <Link href={s.href as never} className="group relative z-10 flex flex-col items-center">
                <span className={cn("flex size-12 items-center justify-center rounded-full border-2 bg-white transition-shadow group-hover:shadow-lift", ring, s.human && "ring-4 ring-warn-fg/15", s.agent && "ring-4 ring-sky/20")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className={cn("mt-2 rounded-pill px-2.5 py-0.5 text-[15px] font-bold tabular", bg, ring.split(" ")[1])}>{num(s.n)}</span>
                <span className="mt-1.5 text-[12.5px] font-semibold text-ink">{s.label}</span>
                <span className="text-[11px] text-ink-faint">{s.sub}</span>
                {s.value !== undefined ? <span className="text-[11px] text-ink-soft">{money(s.value)}</span> : null}
                {s.human ? <span className="mt-1 rounded-pill bg-warn-bg px-2 py-0.5 text-[10px] font-medium uppercase text-warn-fg">human gate</span> : null}
                {s.agent ? <span className="mt-1 rounded-pill bg-tint px-2 py-0.5 text-[10px] font-medium uppercase text-sky">agent-assisted</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
