import Link from "next/link";
import { BellRing, Search } from "lucide-react";

export function Topbar({ pendingApprovals, canApprove, name }: { pendingApprovals: number; canApprove: boolean; name: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/90 px-6 backdrop-blur">
      <form action="/purchase-orders" className="relative w-full max-w-md" role="search">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          name="q"
          type="search"
          placeholder="Search purchase orders…"
          aria-label="Search purchase orders"
          className="w-full rounded-pill border border-line-strong bg-white py-2 pl-9 pr-4 text-[13.5px] focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
        />
      </form>
      <div className="flex items-center gap-3">
        {canApprove ? (
          <Link
            href="/purchase-orders?status=pending_approval"
            className="relative flex items-center gap-2 rounded-pill border border-line-strong px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:border-blue hover:text-blue"
          >
            <BellRing className="size-4" aria-hidden />
            {pendingApprovals > 0 ? (
              <>
                {pendingApprovals} awaiting approval
                <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-warn-fg" aria-hidden />
              </>
            ) : (
              "No approvals pending"
            )}
          </Link>
        ) : null}
        <span className="hidden text-[13px] text-ink-soft sm:inline">{name}</span>
      </div>
    </header>
  );
}
