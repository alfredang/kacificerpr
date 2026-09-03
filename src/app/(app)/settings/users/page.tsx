import { requireAction } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { InviteForm, UserRow } from "@/components/settings/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireAction("users.manage");
  const users = await listUsers();
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Invite a user" subtitle="They receive an email with a single-use link to set their password (72 h)." />
        <CardBody><InviteForm /></CardBody>
      </Card>
      <Card>
        <CardHeader title={`People (${users.length})`} subtitle="Changing a role or deactivating signs that person out everywhere immediately." />
        <div className="hidden grid-cols-[1.2fr_1.4fr_140px_110px_1fr_auto] gap-2 px-4 pb-1 pt-3 text-[11px] font-medium uppercase text-ink-soft md:grid"><span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Password</span><span /></div>
        {users.map((u) => <UserRow key={u.id} u={u} self={u.id === me.id} locked={u.locked} />)}
      </Card>
      <Card>
        <CardHeader title="Role matrix" subtitle="What each role may do (enforced server-side on every action and API call)" />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="text-left text-[11px] uppercase text-ink-soft"><th className="py-1 pr-3">Role</th><th className="py-1 pr-3">Raise PO</th><th className="py-1 pr-3">Approve PO</th><th className="py-1 pr-3">Order / receive</th><th className="py-1 pr-3">Invoices</th><th className="py-1 pr-3">Pay</th><th className="py-1 pr-3">Masters</th><th className="py-1 pr-3">Agents</th><th className="py-1">Settings</th></tr></thead>
            <tbody>
              {[["admin", "✓", "✓", "✓", "✓", "✓", "✓", "✓ apply", "✓"], ["manager", "✓", "✓", "—", "approve", "—", "—", "✓ apply", "view"], ["procurement", "✓", "—", "✓", "record / match", "—", "✓", "✓ apply", "—"], ["finance", "—", "—", "close", "record / match / approve", "✓", "—", "run", "—"], ["sales", "✓", "—", "—", "—", "—", "—", "run", "—"], ["operations", "—", "—", "receive", "—", "—", "SKUs / stock", "run", "—"], ["requester", "✓ own", "—", "—", "—", "—", "—", "run", "—"], ["viewer", "—", "—", "—", "—", "—", "—", "—", "—"]].map((r) => (
                <tr key={r[0]} className="border-t border-line">{r.map((c, i) => <td key={i} className={`py-1.5 pr-3 ${i === 0 ? "font-medium" : "text-ink-soft"}`}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
