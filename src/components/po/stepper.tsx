import { Check, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PO_STAGES, stageIndex } from "@/lib/po-status";
import type { PoStatus } from "@/lib/constants";

/* Horizontal lifecycle stepper. The "Pending approval" node is the human-in-
   the-loop gate and is drawn with a person icon; rejected/cancelled render as
   a red branch off the stage where the flow stopped. */
export function PoStepper({ status, className }: { status: PoStatus; className?: string }) {
  const idx = stageIndex(status);
  const terminalBad = status === "rejected" || status === "cancelled";
  // "closed" is the terminal success state: the last stage is finished, not in progress.
  const complete = status === "closed";
  return (
    <ol className={cn("flex w-full items-start", className)} aria-label="Purchase order progress">
      {PO_STAGES.map((stage, i) => {
        const done = !terminalBad && (i < idx || (complete && i === idx));
        const current = i === idx && !done;
        const bad = terminalBad && current;
        const human = stage.key === "pending_approval";
        return (
          <li key={stage.key} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 ? <span aria-hidden className={cn("absolute left-[-50%] right-[50%] top-4 h-0.5", done || (current && !bad) ? "bg-blue" : "bg-line-strong")} /> : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-[12px] font-semibold transition-colors",
                done && "border-blue bg-blue text-white",
                current && !bad && "border-blue bg-white text-blue ring-4 ring-blue/15",
                bad && "border-bad-fg bg-bad-bg text-bad-fg ring-4 ring-bad-fg/15",
                !done && !current && "border-line-strong bg-white text-ink-faint",
              )}
              aria-current={current ? "step" : undefined}
            >
              {bad ? <X className="size-4" /> : done ? <Check className="size-4" /> : human ? <UserCheck className="size-4" /> : i + 1}
            </span>
            <span className={cn("mt-2 text-[11.5px] font-medium", current ? (bad ? "text-bad-fg" : "text-blue") : done ? "text-ink" : "text-ink-faint")}>
              {bad ? (status === "rejected" ? "Rejected" : "Cancelled") : stage.label}
            </span>
            {human && !bad ? <span className="text-[10.5px] text-ink-faint">human in the loop</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
