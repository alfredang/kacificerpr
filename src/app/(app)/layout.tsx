import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { requireUser } from "@/server/auth/session";
import { can, permissionsFor } from "@/server/auth/rbac";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { HermesWidget } from "@/components/hermes/widget";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ n }] = await getDb().select({ n: count() }).from(purchaseOrders).where(eq(purchaseOrders.status, "pending_approval"));
  const canApprove = can(user.role, "po.approve");
  return (
    <div className="flex min-h-screen bg-tint/50">
      <Sidebar permissions={permissionsFor(user.role)} pendingApprovals={canApprove ? n : 0} user={{ name: user.name, role: user.role }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar pendingApprovals={n} canApprove={canApprove} name={user.name} />
        <main className="flex-1 px-6 py-6 lg:px-8">{children}</main>
        <footer className="border-t border-line px-6 py-4 text-[12px] text-ink-faint">
          Kacific ERP · Powered by{" "}
          <a href="https://www.tertiaryinfotech.com/" target="_blank" rel="noopener" className="text-blue hover:underline">
            Tertiary Infotech Academy Pte Ltd
          </a>
        </footer>
      </div>
      {can(user.role, "agents.run") ? <HermesWidget /> : null}
    </div>
  );
}
