"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAction } from "@/server/auth/session";
import { userActor } from "@/server/services/po";
import { clearIntegrationSecret, recordIntegrationTest, resolveIntegration, saveIntegration, updateCompanySettings } from "@/server/services/settings";
import { inviteUser, setPasswordDirect, updateUser } from "@/server/services/users";
import { createApiKey, revokeApiKey } from "@/server/services/api-keys";
import { deleteTask, executeTask, saveTask } from "@/server/services/tasks";
import { createEndpoint, deleteEndpoint, sendTestEvent, updateEndpoint } from "@/server/services/webhooks";
import { redeliver } from "@/server/webhooks/deliver";
import { purgeDemoData } from "@/server/services/purge";
import { syncAsana } from "@/server/services/asana-sync";
import { testAsana } from "@/server/integrations/asana";
import { testDeepseek } from "@/server/integrations/deepseek";
import { testTelegram } from "@/server/integrations/telegram";
import { passwordPolicy } from "@/server/security/password";
import { API_SCOPES, INTEGRATION_PROVIDERS, ROLES, TASK_KINDS, WEBHOOK_EVENTS, type ApiScope, type WebhookEvent } from "@/lib/constants";
import type { ActionResult } from "./po";

export type SettingsResult = ActionResult & { secret?: string; message?: string };

const companySchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  address: z.string().trim().max(300),
  country: z.string().trim().max(60),
  timezone: z.string().trim().min(2).max(60),
  currency: z.string().trim().length(3),
  poPrefix: z.string().trim().min(1).max(8).regex(/^[A-Z0-9]+$/i),
  approvalThreshold: z.coerce.number().min(0).max(100_000_000),
  priceTolerancePct: z.coerce.number().min(0).max(100),
});

export async function saveCompanyAction(_p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  const parsed = companySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the company details." };
  await updateCompanySettings({ ...parsed.data, poPrefix: parsed.data.poPrefix.toUpperCase() });
  const { audit } = await import("@/server/services/audit");
  await audit({ actor: userActor(user), action: "settings.company", entityType: "company_settings", entityId: "1", payload: parsed.data });
  revalidatePath("/settings");
  return { ok: true, message: "Company settings saved." };
}

const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), name: z.string().trim().min(2).max(120), role: z.enum(ROLES) });

export async function inviteUserAction(_p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("users.manage");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email, name and role." };
  try {
    await inviteUser(parsed.data, userActor(user), user.name);
  } catch (err) {
    if (err instanceof Error && /users_email_idx/.test(err.message)) return { error: "A user with that email already exists." };
    throw err;
  }
  revalidatePath("/settings/users");
  return { ok: true, message: `Invitation sent to ${parsed.data.email}.` };
}

export async function updateUserAction(id: string, _p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("users.manage");
  const parsed = z.object({ name: z.string().trim().min(2).max(120), role: z.enum(ROLES), isActive: z.enum(["on", "off"]).optional(), password: z.string().max(200).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the details." };
  if (id === user.id && (parsed.data.role !== "admin" || parsed.data.isActive !== "on")) return { error: "You cannot demote or deactivate your own account." };
  await updateUser(id, { name: parsed.data.name, role: parsed.data.role, isActive: parsed.data.isActive === "on" }, userActor(user));
  if (parsed.data.password) {
    const policy = passwordPolicy(parsed.data.password);
    if (policy) return { error: policy };
    await setPasswordDirect(id, parsed.data.password, userActor(user));
  }
  revalidatePath("/settings/users");
  return { ok: true, message: "User updated." };
}

const integrationSchema = z.object({ provider: z.enum(INTEGRATION_PROVIDERS), enabled: z.enum(["on", "off"]).optional(), secret: z.string().trim().max(500).optional(), clear: z.string().optional() });

export async function saveIntegrationAction(_p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = integrationSchema.safeParse(raw);
  if (!parsed.success) return { error: "Check the integration details." };
  const config: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (k.startsWith("cfg_") && typeof v === "string") config[k.slice(4)] = v.trim();
  if (parsed.data.clear === "1") await clearIntegrationSecret(parsed.data.provider);
  await saveIntegration(parsed.data.provider, { enabled: parsed.data.enabled === "on", config, secret: parsed.data.secret || null, updatedBy: user.id });
  const { audit } = await import("@/server/services/audit");
  await audit({ actor: userActor(user), action: "integration.update", entityType: "integration", entityId: parsed.data.provider, payload: { enabled: parsed.data.enabled === "on", configKeys: Object.keys(config), secretChanged: Boolean(parsed.data.secret) } });
  revalidatePath("/settings/integrations");
  return { ok: true, message: `${parsed.data.provider} saved.` };
}

export async function testIntegrationAction(provider: string): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  const p = z.enum(INTEGRATION_PROVIDERS).safeParse(provider);
  if (!p.success) return { error: "Unknown provider" };
  const cfg = await resolveIntegration(p.data);
  let result: { ok: boolean; message: string; patch?: Record<string, string> } = { ok: false, message: "No API key configured." };
  if (cfg.secret) {
    if (p.data === "deepseek") result = await testDeepseek(cfg.secret, cfg.config.model);
    else if (p.data === "asana") {
      result = await testAsana(cfg.secret, cfg.config);
      // Persist anything the test resolved (workspace / auto-created project).
      if (result.ok && result.patch && Object.keys(result.patch).length) {
        await saveIntegration("asana", { enabled: true, config: { ...cfg.config, ...result.patch }, updatedBy: user.id });
      }
    }
    else if (p.data === "telegram") result = await testTelegram(cfg.secret, cfg.config);
    else {
      try {
        const { Resend } = await import("resend");
        const r = await new Resend(cfg.secret).domains.list();
        result = r.error ? { ok: false, message: r.error.message } : { ok: true, message: `Connected · ${r.data?.data?.length ?? 0} verified domain(s)` };
      } catch (err) {
        result = { ok: false, message: err instanceof Error ? err.message : String(err) };
      }
    }
  }
  await recordIntegrationTest(p.data, result.ok, result.message);
  revalidatePath("/settings/integrations");
  return result.ok ? { ok: true, message: result.message } : { error: result.message };
}

export async function createApiKeyAction(_p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("apikeys.manage");
  const scopes = formData.getAll("scopes").map(String).filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
  const parsed = z.object({ name: z.string().trim().min(2).max(80), role: z.enum(ROLES) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success || scopes.length === 0) return { error: "Give the key a name, a role and at least one scope." };
  const { raw } = await createApiKey({ name: parsed.data.name, role: parsed.data.role, scopes }, userActor(user), user.id);
  revalidatePath("/settings/api-keys");
  return { ok: true, secret: raw, message: "Copy this key now — it will not be shown again." };
}

export async function revokeApiKeyAction(id: string) {
  const user = await requireAction("apikeys.manage");
  await revokeApiKey(id, userActor(user));
  revalidatePath("/settings/api-keys");
}

const taskSchema = z.object({ name: z.string().trim().min(2).max(80), kind: z.enum(TASK_KINDS), cronExpr: z.string().trim().min(9).max(60), timezone: z.string().trim().min(2).max(60), enabled: z.enum(["on", "off"]).optional() });

export async function saveTaskAction(id: string | null, _p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  const parsed = taskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the task name, kind and cron expression." };
  try {
    await saveTask({ ...parsed.data, enabled: parsed.data.enabled === "on" }, userActor(user), id ?? undefined);
  } catch (err) {
    return { error: `Invalid cron expression: ${err instanceof Error ? err.message : String(err)}` };
  }
  revalidatePath("/settings/scheduled-tasks");
  return { ok: true, message: "Scheduled task saved." };
}

export async function runTaskNowAction(id: string) {
  await requireAction("settings.manage");
  await executeTask(id, "manual");
  revalidatePath("/settings/scheduled-tasks");
}

export async function deleteTaskAction(id: string) {
  const user = await requireAction("settings.manage");
  await deleteTask(id, userActor(user));
  revalidatePath("/settings/scheduled-tasks");
}

const endpointSchema = z.object({ name: z.string().trim().min(2).max(80), url: z.string().trim().url().max(500).or(z.string().regex(/^mock:\/\//)), enabled: z.enum(["on", "off"]).optional() });

export async function saveEndpointAction(id: string | null, _p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  const parsed = endpointSchema.safeParse(Object.fromEntries(formData));
  const events = formData.getAll("events").map(String).filter((e): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e));
  if (!parsed.success || events.length === 0) return { error: "Give the endpoint a name, an https URL and at least one event." };
  if (!parsed.data.url.startsWith("https://") && !parsed.data.url.startsWith("mock://") && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(parsed.data.url)) return { error: "Webhook URLs must use https:// (http is allowed only for localhost)." };
  const input = { name: parsed.data.name, url: parsed.data.url, events, enabled: parsed.data.enabled === "on" };
  if (id) {
    await updateEndpoint(id, input, userActor(user));
    revalidatePath("/settings/webhooks");
    return { ok: true, message: "Endpoint updated." };
  }
  const { secret } = await createEndpoint(input, userActor(user));
  revalidatePath("/settings/webhooks");
  return { ok: true, secret, message: "Endpoint created. Copy the signing secret now — it will not be shown again." };
}

export async function deleteEndpointAction(id: string) {
  const user = await requireAction("settings.manage");
  await deleteEndpoint(id, userActor(user));
  revalidatePath("/settings/webhooks");
}

export async function testEndpointAction(id: string) {
  const user = await requireAction("settings.manage");
  await sendTestEvent(id, userActor(user));
  revalidatePath("/settings/webhooks");
}

export async function redeliverAction(deliveryId: string) {
  await requireAction("settings.manage");
  await redeliver([deliveryId]);
  revalidatePath("/settings/webhooks");
}

export async function purgeDemoDataAction(_p: SettingsResult, formData: FormData): Promise<SettingsResult> {
  const user = await requireAction("settings.manage");
  if (String(formData.get("confirm") ?? "") !== "DELETE") return { error: "Type DELETE to confirm." };
  const c = await purgeDemoData(userActor(user));
  revalidatePath("/", "layout");
  return { ok: true, message: `Demo data removed: ${c.purchaseOrders} purchase orders, ${c.invoices} invoices, ${c.skus} SKUs, ${c.vendors} vendors. Logins, settings and integrations are untouched.` };
}

export async function syncAsanaAction(): Promise<SettingsResult> {
  const user = await requireAction("asana.sync");
  const r = await syncAsana(userActor(user));
  revalidatePath("/asana");
  revalidatePath("/purchase-orders");
  return r.ok ? { ok: true, message: r.message } : { error: r.message };
}
