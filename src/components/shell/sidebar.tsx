"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import type { Action } from "@/server/auth/rbac";
import { logoutAction } from "@/server/actions/auth";

const KEY = "kacific.sidebar.collapsed";

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener("kacific-sidebar", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("kacific-sidebar", cb);
  };
}
function getSnapshot() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({ permissions, pendingApprovals, user }: { permissions: Action[]; pendingApprovals: number; user: { name: string; role: string } }) {
  const pathname = usePathname();
  /* Persisted per browser via localStorage; useSyncExternalStore keeps the
     server render (expanded) and the first client paint consistent. */
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);

  function toggle() {
    try {
      localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event("kacific-sidebar"));
  }

  const items = NAV.filter((n) => permissions.includes(n.action));

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "sticky top-0 flex h-screen shrink-0 flex-col bg-blue-footer text-white transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-[248px]",
        !ready && "transition-none",
      )}
      aria-label="Primary"
    >
      <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-5")}>
        <Link href="/dashboard" className="flex items-center gap-2" aria-label="Kacific ERP dashboard">
          {collapsed ? (
            <Image src="/icon.png" alt="" width={28} height={28} className="rounded-sm" />
          ) : (
            <Image src="/kacific-logo.png" alt="Kacific" width={120} height={43} priority className="brightness-0 invert" />
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            const badge = item.badge === "approvals" && pendingApprovals > 0 ? pendingApprovals : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href as never}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-card px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active ? "bg-white text-blue" : "text-white/85 hover:bg-white/10 hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <span className="relative">
                    <Icon className="size-[18px] shrink-0" aria-hidden />
                    {badge && collapsed ? (
                      <span className="absolute -right-2 -top-1.5 rounded-pill bg-warn-fg px-1.5 text-[10px] font-semibold text-white">{badge}</span>
                    ) : null}
                  </span>
                  {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                  {!collapsed && badge ? (
                    <span className={cn("rounded-pill px-2 py-0.5 text-[11px] font-semibold", active ? "bg-warn-bg text-warn-fg" : "bg-warn-fg text-white")}>{badge}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 p-2">
        {!collapsed ? (
          <div className="mb-2 px-3 py-1">
            <p className="truncate text-[13px] font-medium">{user.name}</p>
            <p className="truncate text-[11.5px] uppercase text-white/60">{user.role}</p>
          </div>
        ) : null}
        <div className={cn("flex", collapsed ? "flex-col items-center gap-1" : "items-center justify-between")}>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              className="flex items-center gap-2 rounded-card px-3 py-2 text-[13px] text-white/80 hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              {!collapsed ? "Sign out" : null}
            </button>
          </form>
          <button
            type="button"
            onClick={toggle}
            aria-pressed={collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-card p-2 text-white/80 hover:bg-white/10 hover:text-white"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
