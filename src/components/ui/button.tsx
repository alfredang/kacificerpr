import * as React from "react";
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/* Brand button: pill radius, uppercase label, weight 500. Primary inverts on
   hover the way kacific.com's buttons do; `on-blue` is for dark bands. */
const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-pill border font-medium uppercase tracking-normal whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-200 ease-out disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky",
  {
    variants: {
      variant: {
        primary: "bg-blue border-blue text-white hover:bg-white hover:text-blue",
        secondary: "bg-white border-blue text-blue hover:bg-blue hover:text-white",
        ghost: "bg-transparent border-line-strong text-ink-soft hover:bg-ink-soft hover:border-ink-soft hover:text-white",
        danger: "bg-white border-bad-fg text-bad-fg hover:bg-bad-fg hover:text-white",
        success: "bg-white border-ok-fg text-ok-fg hover:bg-ok-fg hover:text-white",
        "on-blue": "bg-white border-white text-blue hover:bg-blue-deep hover:text-white",
        link: "border-transparent text-blue normal-case hover:underline px-0",
      },
      size: {
        sm: "text-[11px] px-3.5 py-1.5",
        md: "text-[12.5px] px-5 py-2.5",
        lg: "text-[13px] px-7 py-3",
        icon: "size-9 p-0 normal-case",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button> & { href?: string; loading?: boolean };

export function Button({ className, variant, size, href, loading, children, disabled, ...props }: Props) {
  const cls = cn(button({ variant, size }), className);
  if (href) {
    return (
      <Link href={href as never} className={cls} aria-disabled={disabled || undefined}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export { button as buttonVariants };
