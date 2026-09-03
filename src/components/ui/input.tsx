import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-card border border-line-strong bg-white px-3 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15 disabled:bg-wash disabled:text-ink-faint aria-invalid:border-bad-fg aria-invalid:ring-bad-fg/15";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-24", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23616161%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[position:right_12px_center] bg-no-repeat pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-[12.5px] font-medium text-ink-soft", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-[12.5px] text-bad-fg" id={htmlFor ? `${htmlFor}-error` : undefined} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-[13.5px] text-ink", className)}>
      <input type="checkbox" className="size-4 rounded-sm border-line-strong accent-blue" {...props} />
      {label}
    </label>
  );
}
