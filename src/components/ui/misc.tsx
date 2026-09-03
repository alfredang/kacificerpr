import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="mb-1 text-[11.5px] font-medium uppercase text-sky">{eyebrow}</p> : null}
        <h1 className="text-[26px] font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[14px] text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  tone = "blue",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "blue" | "ok" | "warn" | "bad";
  href?: string;
}) {
  const border = { blue: "border-t-blue", ok: "border-t-ok-fg", warn: "border-t-warn-fg", bad: "border-t-bad-fg" }[tone];
  const color = { blue: "text-blue", ok: "text-ok-fg", warn: "text-warn-fg", bad: "text-bad-fg" }[tone];
  const inner = (
    <div className={cn("relative overflow-hidden rounded-card border border-line border-t-4 bg-card px-5 py-4 shadow-lift transition-shadow", border, href && "hover:shadow-card")}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-14 size-40 rounded-full border border-cyan/25" />
      <p className="text-[11.5px] font-medium uppercase text-ink-soft">{label}</p>
      <p className={cn("mt-1 text-[34px] font-bold leading-none tabular", color)}>{value}</p>
      {sub ? <p className="mt-2 text-[12.5px] text-ink-faint">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href as never}>{inner}</Link> : inner;
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "ok" | "warn" | "bad"; title?: string; children?: React.ReactNode; className?: string }) {
  const map = {
    info: ["bg-tint text-blue border-line", Info],
    ok: ["bg-ok-bg text-ok-fg border-ok-fg/20", CheckCircle2],
    warn: ["bg-warn-bg text-warn-fg border-warn-fg/20", AlertTriangle],
    bad: ["bg-bad-bg text-bad-fg border-bad-fg/20", XCircle],
  } as const;
  const [cls, Icon] = map[tone];
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cn("flex gap-3 rounded-card border px-4 py-3 text-[13.5px]", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-tint/60 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-[13.5px] text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Stat({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium uppercase text-ink-faint">{label}</p>
      <p className="mt-0.5 truncate text-[14px] text-ink">{value}</p>
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[11.5px] font-medium uppercase text-sky", className)}>{children}</p>;
}
