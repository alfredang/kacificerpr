import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  );
}

export function Th({ className, right, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      className={cn(
        "border-b-2 border-line-strong px-3 py-2.5 text-left text-[11px] font-medium uppercase text-ink-soft whitespace-nowrap",
        right && "text-right",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, right, mono, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean; mono?: boolean }) {
  return (
    <td className={cn("border-b border-line px-3 py-2.5 align-middle text-ink", right && "text-right tabular", mono && "font-mono text-[12.5px]", className)} {...props}>
      {children}
    </td>
  );
}

export function Tr({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("transition-colors hover:bg-accent-tint/60", className)} {...props}>
      {children}
    </tr>
  );
}
