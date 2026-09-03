import { requireAction } from "@/server/auth/session";
import { listEndpoints, listInbound } from "@/server/services/webhooks";
import { EndpointButtons, EndpointForm, RedeliverButton } from "@/components/settings/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WebhooksPage() {
  await requireAction("settings.manage");
  const [endpoints, inbound] = await Promise.all([listEndpoints(), listInbound(15)]);
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return (
    <div className="space-y-5">
      <Alert tone="info">Outbound deliveries are signed: <code>X-Kacific-Signature: sha256=HMAC_SHA256(secret, timestamp + &quot;.&quot; + body)</code> with <code>X-Kacific-Timestamp</code>. Failed deliveries retry after 1 m, 5 m, 30 m, 2 h and 12 h via the “Webhook retry sweep” task.</Alert>
      <Card>
        <CardHeader title="Add an endpoint" subtitle="The signing secret is generated for you and shown once." />
        <CardBody><EndpointForm /></CardBody>
      </Card>
      {endpoints.map((e) => (
        <Card key={e.id}>
          <CardHeader title={<span className="flex items-center gap-2">{e.name} <Badge tone={e.enabled ? "ok" : "neutral"}>{e.enabled ? "enabled" : "paused"}</Badge></span>} subtitle={<span className="font-mono text-[12px]">{e.url}</span>} actions={<EndpointButtons id={e.id} />} />
          <CardBody><EndpointForm endpoint={e} /></CardBody>
          <CardBody className="border-t border-line text-[12.5px] text-ink-soft">Inbound URL for this endpoint: <code className="break-all">{base}/api/webhooks/inbound/{e.inboundKey}</code></CardBody>
          <Table>
            <thead><tr><Th>When</Th><Th>Event</Th><Th>Status</Th><Th right>Attempt</Th><Th right>HTTP</Th><Th right>ms</Th><Th>Next retry</Th><Th /></tr></thead>
            <tbody>
              {e.deliveries.map((d) => (
                <Tr key={d.id}><Td className="text-ink-faint">{dateTime(d.createdAt)}</Td><Td mono>{d.event}</Td><Td><Badge tone={d.status === "delivered" ? "ok" : d.status === "pending" ? "neutral" : "bad"}>{d.status}</Badge></Td><Td right>{d.attempt}</Td><Td right>{d.responseCode ?? "—"}</Td><Td right>{d.responseMs ?? "—"}</Td><Td className="text-ink-faint">{d.nextRetryAt ? dateTime(d.nextRetryAt) : "—"}</Td><Td>{d.status !== "delivered" ? <RedeliverButton id={d.id} /> : null}</Td></Tr>
              ))}
              {e.deliveries.length === 0 ? <tr><Td colSpan={8} className="text-center text-ink-faint">No deliveries yet — send a test event.</Td></tr> : null}
            </tbody>
          </Table>
        </Card>
      ))}
      <Card>
        <CardHeader title="Inbound log" subtitle={`Asana receiver: ${base}/api/webhooks/asana · generic receivers per endpoint above`} />
        <Table>
          <thead><tr><Th>When</Th><Th>Source</Th><Th>Verified</Th><Th>Payload</Th></tr></thead>
          <tbody>
            {inbound.map((i) => <Tr key={i.id}><Td className="text-ink-faint">{dateTime(i.createdAt)}</Td><Td>{i.source}</Td><Td><Badge tone={i.verified ? "ok" : "warn"}>{i.verified ? "signed" : "unsigned"}</Badge></Td><Td className="max-w-md truncate font-mono text-[11.5px]">{JSON.stringify(i.payload).slice(0, 160)}</Td></Tr>)}
            {inbound.length === 0 ? <tr><Td colSpan={4} className="text-center text-ink-faint">Nothing received yet.</Td></tr> : null}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
