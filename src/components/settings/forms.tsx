"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import {
  createApiKeyAction,
  deleteEndpointAction,
  deleteTaskAction,
  inviteUserAction,
  redeliverAction,
  revokeApiKeyAction,
  runTaskNowAction,
  saveCompanyAction,
  saveEndpointAction,
  saveIntegrationAction,
  saveTaskAction,
  testEndpointAction,
  testIntegrationAction,
  updateUserAction,
  type SettingsResult,
} from "@/server/actions/settings";
import { API_SCOPES, ROLES, TASK_KINDS, TASK_KIND_LABEL, WEBHOOK_EVENTS, DEEPSEEK_MODELS, DEEPSEEK_THINKING } from "@/lib/constants";
import type { IntegrationView } from "@/server/services/settings";
import type { User, ScheduledTask, WebhookEndpoint } from "@/db/schema";

function Feedback({ state }: { state: SettingsResult }) {
  if (state.error) return <Alert tone="bad">{state.error}</Alert>;
  if (state.secret) return <Alert tone="ok" title={state.message}><code className="mt-1 block break-all rounded-sm bg-white px-2 py-1 font-mono text-[12.5px] text-ink" data-testid="secret">{state.secret}</code></Alert>;
  if (state.ok) return <Alert tone="ok">{state.message}</Alert>;
  return null;
}

export function CompanyForm({ s }: { s: { name: string; legalName: string; address: string; country: string; timezone: string; currency: string; poPrefix: string; approvalThreshold: number; priceTolerancePct: number } }) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(saveCompanyAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Company name" htmlFor="name"><Input id="name" name="name" defaultValue={s.name} required /></Field>
        <Field label="Legal name" htmlFor="legalName" className="md:col-span-2"><Input id="legalName" name="legalName" defaultValue={s.legalName} required /></Field>
        <Field label="Address" htmlFor="address" className="md:col-span-2"><Input id="address" name="address" defaultValue={s.address} /></Field>
        <Field label="Country" htmlFor="country"><Input id="country" name="country" defaultValue={s.country} /></Field>
        <Field label="Timezone" htmlFor="timezone" hint="IANA name, e.g. Asia/Singapore, Pacific/Port_Moresby"><Input id="timezone" name="timezone" defaultValue={s.timezone} /></Field>
        <Field label="Base currency" htmlFor="currency"><Input id="currency" name="currency" defaultValue={s.currency} maxLength={3} /></Field>
        <Field label="PO number prefix" htmlFor="poPrefix"><Input id="poPrefix" name="poPrefix" defaultValue={s.poPrefix} /></Field>
        <Field label="Auto-approve POs under (USD)" htmlFor="approvalThreshold" hint="0 disables auto-approval; every PO then needs a manager"><Input id="approvalThreshold" name="approvalThreshold" type="number" min={0} step="0.01" defaultValue={s.approvalThreshold} /></Field>
        <Field label="Invoice price tolerance (%)" htmlFor="priceTolerancePct" hint="Unit-price variance allowed by the 3-way match"><Input id="priceTolerancePct" name="priceTolerancePct" type="number" min={0} step="0.1" defaultValue={s.priceTolerancePct} /></Field>
      </div>
      <div className="flex justify-end"><Button type="submit" loading={pending}>Save company settings</Button></div>
    </form>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(inviteUserAction, {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <Feedback state={state} />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px_auto] md:items-end">
        <Field label="Name" htmlFor="inv-name"><Input id="inv-name" name="name" required /></Field>
        <Field label="Work email" htmlFor="inv-email"><Input id="inv-email" name="email" type="email" required /></Field>
        <Field label="Role" htmlFor="inv-role"><Select id="inv-role" name="role" defaultValue="requester">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
        <Button type="submit" loading={pending}>Invite</Button>
      </div>
    </form>
  );
}

export function UserRow({ u, self, locked }: { u: User; self: boolean; locked: boolean }) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(updateUserAction.bind(null, u.id), {});
  return (
    <form action={action} className="grid gap-2 border-t border-line px-4 py-3 md:grid-cols-[1.2fr_1.4fr_140px_110px_1fr_auto] md:items-center" noValidate>
      <Input name="name" defaultValue={u.name} aria-label="Name" />
      <span className="truncate text-[13px] text-ink-soft">{u.email}{self ? <Badge tone="blue" className="ml-2">you</Badge> : null}{locked ? <Badge tone="bad" className="ml-2">locked</Badge> : null}</span>
      <Select name="role" defaultValue={u.role} aria-label="Role">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
      <Checkbox name="isActive" label="Active" defaultChecked={u.isActive} />
      <Input name="password" type="password" placeholder="Set new password…" autoComplete="new-password" aria-label="New password" />
      <Button type="submit" size="sm" variant="secondary" loading={pending}>Save</Button>
      {state.error || state.ok ? <div className="md:col-span-6"><Feedback state={state} /></div> : null}
    </form>
  );
}

type FieldMeta = { key: string; label: string; hint?: string; options?: readonly { id: string; label: string }[] };
const INTEGRATION_META: Record<string, { title: string; desc: string; secretLabel: string; fields: FieldMeta[] }> = {
  resend: { title: "Resend (email)", desc: "Sends approval requests, decisions, password resets, invitations and digests.", secretLabel: "Resend API key", fields: [{ key: "from", label: "From address", hint: 'e.g. Kacific ERP <erp@yourdomain.com> — the domain must be verified in Resend' }] },
  deepseek: { title: "DeepSeek (AI agents)", desc: "Powers the agentic processes: PO drafting, reorder review, invoice match, vendor risk and the co-pilot chat. OpenAI-compatible Chat Completions API (api.deepseek.com).", secretLabel: "DeepSeek API key", fields: [{ key: "model", label: "Model", hint: "V4 Flash for fast, cheap tool loops; V4 Pro for the hardest analyses. Both have a 1M-token context.", options: DEEPSEEK_MODELS }, { key: "thinking", label: "Thinking mode", hint: "Off is fastest for tool calling; on adds reasoning (reasoning_effort low/high).", options: DEEPSEEK_THINKING }] },
  telegram: { title: "Telegram (Hermes chatbot)", desc: "Lets staff talk to the Hermes agent from Telegram and powers the in-app chat widget's “Open in Telegram” link. Webhook: /api/webhooks/telegram.", secretLabel: "Bot token (from @BotFather)", fields: [{ key: "botUsername", label: "Bot username", hint: "without @, e.g. KacificHermesBot" }, { key: "allowedChatIds", label: "Allowed chat IDs", hint: "comma-separated; the bot tells unknown users their chat id" }, { key: "webhookSecret", label: "Webhook secret token", hint: "any random string; sent by Telegram as X-Telegram-Bot-Api-Secret-Token" }] },
  asana: { title: "Asana (approvals board)", desc: "Creates a task when a PO is submitted and completes it when the PO is decided.", secretLabel: "Personal access token", fields: [{ key: "projectGid", label: "Project GID", hint: "Tasks are added to this project" }, { key: "workspaceGid", label: "Workspace GID", hint: "Used only when no project is set" }] },
};

export function IntegrationCard({ i }: { i: IntegrationView }) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(saveIntegrationAction, {});
  const [testState, testAction, testing] = useActionState<SettingsResult, FormData>(() => testIntegrationAction(i.provider), {});
  const meta = INTEGRATION_META[i.provider];
  return (
    <div className="rounded-card border border-line bg-white shadow-card">
      <form action={action} className="space-y-4 p-5" noValidate>
        <input type="hidden" name="provider" value={i.provider} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">{meta.title} <Badge tone={i.enabled && i.hasSecret ? "ok" : "neutral"}>{i.enabled && i.hasSecret ? "enabled" : "off"}</Badge>{i.envFallback ? <Badge tone="sky">key from environment</Badge> : null}</h2>
            <p className="mt-0.5 text-[13px] text-ink-soft">{meta.desc}</p>
          </div>
          <Checkbox name="enabled" label="Enabled" defaultChecked={i.enabled} />
        </div>
        <Feedback state={state} />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={meta.secretLabel} htmlFor={`${i.provider}-secret`} hint={i.hasSecret ? `A key ending in …${i.secretLast4} is stored encrypted. Leave blank to keep it.` : "Stored encrypted (AES-256-GCM); never shown again."}>
            <Input id={`${i.provider}-secret`} name="secret" type="password" autoComplete="off" placeholder={i.hasSecret ? "••••••••" : ""} />
          </Field>
          {meta.fields.map((f) => (
            <Field key={f.key} label={f.label} htmlFor={`${i.provider}-${f.key}`} hint={f.hint}>
              {f.options ? (
                <Select id={`${i.provider}-${f.key}`} name={`cfg_${f.key}`} defaultValue={f.options.some((o) => o.id === i.config[f.key]) ? i.config[f.key] : f.options[0].id}>
                  {f.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </Select>
              ) : (
                <Input id={`${i.provider}-${f.key}`} name={`cfg_${f.key}`} defaultValue={i.config[f.key] ?? ""} />
              )}
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" loading={pending}>Save</Button>
          {i.hasSecret && !i.envFallback ? <Button type="submit" name="clear" value="1" size="sm" variant="ghost">Remove stored key</Button> : null}
        </div>
      </form>
      <form action={testAction} className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
        <Button type="submit" size="sm" variant="secondary" loading={testing} disabled={!i.hasSecret}>Test connection</Button>
        {testState.error ? <span className="text-[13px] text-bad-fg">{testState.error}</span> : testState.ok ? <span className="text-[13px] text-ok-fg">{testState.message}</span> : i.lastTestedAt ? <span className={`text-[12.5px] ${i.lastTestOk ? "text-ok-fg" : "text-bad-fg"}`}>Last test {i.lastTestOk ? "passed" : "failed"} · {i.lastTestMessage}</span> : <span className="text-[12.5px] text-ink-faint">Not tested yet</span>}
      </form>
    </div>
  );
}

export function ApiKeyForm() {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(createApiKeyAction, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <Feedback state={state} />
      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <Field label="Key name" htmlFor="key-name" hint="e.g. Hermes agent (production)"><Input id="key-name" name="name" required /></Field>
        <Field label="Role for RBAC" htmlFor="key-role" hint="approve:po needs manager or admin"><Select id="key-role" name="role" defaultValue="procurement">{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</Select></Field>
      </div>
      <fieldset>
        <legend className="mb-2 text-[12.5px] font-medium text-ink-soft">Scopes</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">{API_SCOPES.map((s) => <Checkbox key={s} name="scopes" value={s} label={<code className="text-[12.5px]">{s}</code>} defaultChecked={["read:stock", "read:vendors", "read:po", "read:invoices"].includes(s)} />)}</div>
      </fieldset>
      <Button type="submit" loading={pending}>Create API key</Button>
    </form>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="danger" loading={pending} onClick={() => start(() => revokeApiKeyAction(id))}>Revoke</Button>;
}

export function TaskForm({ task, onDone }: { task?: ScheduledTask; onDone?: () => void }) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(saveTaskAction.bind(null, task?.id ?? null), {});
  return (
    <form action={action} className="space-y-3" noValidate onSubmit={() => onDone?.()}>
      <Feedback state={state} />
      <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_1fr_1fr_auto_auto] md:items-end">
        <Field label="Name" htmlFor={`t-name-${task?.id ?? "new"}`}><Input id={`t-name-${task?.id ?? "new"}`} name="name" defaultValue={task?.name ?? ""} required /></Field>
        <Field label="Job" htmlFor={`t-kind-${task?.id ?? "new"}`}><Select id={`t-kind-${task?.id ?? "new"}`} name="kind" defaultValue={task?.kind ?? "low_stock_scan"}>{TASK_KINDS.map((k) => <option key={k} value={k}>{TASK_KIND_LABEL[k]}</option>)}</Select></Field>
        <Field label="Cron (5 fields)" htmlFor={`t-cron-${task?.id ?? "new"}`}><Input id={`t-cron-${task?.id ?? "new"}`} name="cronExpr" defaultValue={task?.cronExpr ?? "0 8 * * 1-5"} placeholder="0 8 * * 1-5" className="font-mono" required /></Field>
        <Field label="Timezone" htmlFor={`t-tz-${task?.id ?? "new"}`}><Input id={`t-tz-${task?.id ?? "new"}`} name="timezone" defaultValue={task?.timezone ?? "Asia/Singapore"} /></Field>
        <Checkbox name="enabled" label="Enabled" defaultChecked={task?.enabled ?? true} className="pb-2" />
        <Button type="submit" size="sm" loading={pending}>{task ? "Save" : "Add task"}</Button>
      </div>
    </form>
  );
}

export function TaskButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" loading={pending} onClick={() => start(() => runTaskNowAction(id))}>Run now</Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => { if (confirm("Delete this scheduled task?")) start(() => deleteTaskAction(id)); }}>Delete</Button>
    </div>
  );
}

export function EndpointForm({ endpoint }: { endpoint?: WebhookEndpoint }) {
  const [state, action, pending] = useActionState<SettingsResult, FormData>(saveEndpointAction.bind(null, endpoint?.id ?? null), {});
  return (
    <form action={action} className="space-y-3" noValidate>
      <Feedback state={state} />
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto] md:items-end">
        <Field label="Name" htmlFor={`w-name-${endpoint?.id ?? "new"}`}><Input id={`w-name-${endpoint?.id ?? "new"}`} name="name" defaultValue={endpoint?.name ?? ""} required /></Field>
        <Field label="HTTPS URL" htmlFor={`w-url-${endpoint?.id ?? "new"}`}><Input id={`w-url-${endpoint?.id ?? "new"}`} name="url" defaultValue={endpoint?.url ?? ""} placeholder="https://hooks.example.com/kacific" required /></Field>
        <Checkbox name="enabled" label="Enabled" defaultChecked={endpoint?.enabled ?? true} className="pb-2" />
        <Button type="submit" size="sm" loading={pending}>{endpoint ? "Save" : "Add endpoint"}</Button>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-[12.5px] font-medium text-ink-soft">Events</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">{WEBHOOK_EVENTS.filter((e) => e !== "test.ping").map((e) => <Checkbox key={e} name="events" value={e} label={<code className="text-[12px]">{e}</code>} defaultChecked={endpoint ? endpoint.events.includes(e) : ["po.submitted", "po.approved"].includes(e)} />)}</div>
      </fieldset>
    </form>
  );
}

export function EndpointButtons({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" loading={pending} onClick={() => start(() => testEndpointAction(id))}>Send test event</Button>
      <Button size="sm" variant="ghost" loading={pending} onClick={() => { if (confirm("Delete this endpoint and its delivery log?")) start(() => deleteEndpointAction(id)); }}>Delete</Button>
    </div>
  );
}

export function RedeliverButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <Button size="sm" variant="link" loading={pending} onClick={() => start(() => redeliverAction(id))}>Redeliver</Button>;
}

export { Textarea };
