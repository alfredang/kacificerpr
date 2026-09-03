import { requireAction } from "@/server/auth/session";
import { listApiKeys } from "@/server/services/api-keys";
import { ApiKeyForm, RevokeButton } from "@/components/settings/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  await requireAction("apikeys.manage");
  const keys = await listApiKeys();
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Create an API key" subtitle="For external agents such as Hermes. Keys are bound to a service-account role (RBAC) and to scopes; they are hashed at rest and shown once." />
        <CardBody><ApiKeyForm /></CardBody>
      </Card>
      <Card>
        <CardHeader title={`Keys (${keys.filter((k) => !k.revokedAt).length} active)`} />
        <Table>
          <thead><tr><Th>Name</Th><Th>Prefix</Th><Th>Role</Th><Th>Scopes</Th><Th>Last used</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {keys.map((k) => (
              <Tr key={k.id}>
                <Td>{k.name}</Td><Td mono>{k.prefix}…</Td><Td>{k.serviceUser.role}</Td>
                <Td><span className="flex flex-wrap gap-1">{k.scopes.map((s) => <code key={s} className="rounded-sm bg-wash px-1.5 py-0.5 text-[11.5px]">{s}</code>)}</span></Td>
                <Td className="text-ink-faint">{dateTime(k.lastUsedAt)}</Td>
                <Td>{k.revokedAt ? <Badge tone="bad">revoked</Badge> : <Badge tone="ok">active</Badge>}</Td>
                <Td>{!k.revokedAt ? <RevokeButton id={k.id} /> : null}</Td>
              </Tr>
            ))}
            {keys.length === 0 ? <tr><Td colSpan={7} className="text-center text-ink-faint">No keys yet.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="Connecting an agent" subtitle="REST + OpenAPI, or MCP — same tools, same key." />
        <CardBody className="space-y-3 text-[13px]">
          <pre className="overflow-x-auto rounded-card bg-wash p-3 font-mono text-[12px]">{`# discover
curl ${base}/api/v1/openapi.json

# read
curl -H "Authorization: Bearer kfc_live_…" "${base}/api/v1/low-stock"
curl -H "Authorization: Bearer kfc_live_…" "${base}/api/v1/purchase-orders/PO-2026-0012"

# write (draft → submit)
curl -X POST -H "Authorization: Bearer kfc_live_…" -H "Content-Type: application/json" \\
  -d '{"vendorId":"<uuid>","warehouseCode":"SUV","lines":[{"sku":"TRM-1200","qty":20}]}' ${base}/api/v1/purchase-orders

# MCP (Streamable HTTP, stateless)
curl -X POST -H "Authorization: Bearer kfc_live_…" -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' ${base}/api/v1/mcp`}</pre>
          <p className="text-ink-soft">MCP client config: <code>{`{"url":"${base}/api/v1/mcp","headers":{"Authorization":"Bearer kfc_live_…"}}`}</code>. Full guide in <code>docs/HERMES.md</code>.</p>
        </CardBody>
      </Card>
    </div>
  );
}
