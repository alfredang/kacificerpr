"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/company", label: "Company" },
  { href: "/settings/users", label: "Users & roles", manage: true },
  { href: "/settings/integrations", label: "Integrations", manage: true },
  { href: "/settings/api-keys", label: "API keys", manage: true },
  { href: "/settings/scheduled-tasks", label: "Scheduled tasks", manage: true },
  { href: "/settings/webhooks", label: "Webhooks", manage: true },
];

export function SettingsTabs({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-line" aria-label="Settings sections">
      {TABS.filter((t) => !t.manage || canManage).map((t) => (
        <Link key={t.href} href={t.href as never} className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] font-medium", pathname.startsWith(t.href) ? "border-blue text-blue" : "border-transparent text-ink-soft hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
