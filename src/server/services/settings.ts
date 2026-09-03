import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { companySettings, integrationSettings } from "@/db/schema";
import type { IntegrationProvider } from "@/lib/constants";
import { decrypt, encrypt, last4 } from "@/server/security/crypto";

export async function getCompanySettings() {
  const db = getDb();
  const row = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  if (row) return row;
  const [created] = await db.insert(companySettings).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) }))!;
}

export async function updateCompanySettings(patch: Partial<typeof companySettings.$inferInsert>) {
  const db = getDb();
  await getCompanySettings();
  const [row] = await db
    .update(companySettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(companySettings.id, 1))
    .returning();
  return row;
}

export type IntegrationView = {
  provider: IntegrationProvider;
  enabled: boolean;
  config: Record<string, string>;
  secretLast4: string | null;
  hasSecret: boolean;
  envFallback: boolean;
  lastTestedAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
};

const ENV_SECRET: Record<IntegrationProvider, string> = {
  resend: "RESEND_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  asana: "ASANA_PAT",
  telegram: "TELEGRAM_BOT_TOKEN",
};

/* Secrets are resolved DB-first (encrypted at rest), then the environment.
   The client never receives the secret — only whether one exists and its
   last four characters. */
export async function getIntegration(provider: IntegrationProvider): Promise<IntegrationView> {
  const db = getDb();
  const row = await db.query.integrationSettings.findFirst({ where: eq(integrationSettings.provider, provider) });
  const envSecret = process.env[ENV_SECRET[provider]];
  return {
    provider,
    enabled: row?.enabled ?? Boolean(envSecret),
    config: row?.config ?? {},
    secretLast4: row?.secretLast4 ?? (envSecret ? last4(envSecret) : null),
    hasSecret: Boolean(row?.secretCiphertext || envSecret),
    envFallback: !row?.secretCiphertext && Boolean(envSecret),
    lastTestedAt: row?.lastTestedAt ?? null,
    lastTestOk: row?.lastTestOk ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
  };
}

export async function resolveIntegration(provider: IntegrationProvider) {
  const db = getDb();
  const row = await db.query.integrationSettings.findFirst({ where: eq(integrationSettings.provider, provider) });
  const envSecret = process.env[ENV_SECRET[provider]] || null;
  const secret = row?.secretCiphertext ? decrypt(row.secretCiphertext) : envSecret;
  const enabled = row ? row.enabled : Boolean(envSecret);
  const envConfig: Record<string, string> = {};
  if (provider === "asana") {
    if (process.env.ASANA_PROJECT_GID) envConfig.projectGid = process.env.ASANA_PROJECT_GID;
    if (process.env.ASANA_WORKSPACE_GID) envConfig.workspaceGid = process.env.ASANA_WORKSPACE_GID;
  }
  if (provider === "deepseek") {
    if (process.env.DEEPSEEK_MODEL) envConfig.model = process.env.DEEPSEEK_MODEL;
    if (process.env.DEEPSEEK_THINKING) envConfig.thinking = process.env.DEEPSEEK_THINKING;
  }
  if (provider === "resend" && process.env.EMAIL_FROM) envConfig.from = process.env.EMAIL_FROM;
  if (provider === "telegram") {
    if (process.env.TELEGRAM_BOT_USERNAME) envConfig.botUsername = process.env.TELEGRAM_BOT_USERNAME;
    if (process.env.TELEGRAM_ALLOWED_CHAT_IDS) envConfig.allowedChatIds = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
    if (process.env.TELEGRAM_WEBHOOK_SECRET) envConfig.webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  }
  return { enabled: enabled && Boolean(secret), secret, config: { ...envConfig, ...(row?.config ?? {}) } };
}

export async function saveIntegration(
  provider: IntegrationProvider,
  input: { enabled: boolean; config: Record<string, string>; secret?: string | null; updatedBy: string },
) {
  const db = getDb();
  const patch: Partial<typeof integrationSettings.$inferInsert> = {
    enabled: input.enabled,
    config: input.config,
    updatedBy: input.updatedBy,
    updatedAt: new Date(),
  };
  if (input.secret) {
    patch.secretCiphertext = encrypt(input.secret);
    patch.secretLast4 = last4(input.secret);
  }
  await db
    .insert(integrationSettings)
    .values({ provider, ...patch })
    .onConflictDoUpdate({ target: integrationSettings.provider, set: patch });
}

export async function clearIntegrationSecret(provider: IntegrationProvider) {
  const db = getDb();
  await db
    .update(integrationSettings)
    .set({ secretCiphertext: null, secretLast4: null, updatedAt: new Date() })
    .where(eq(integrationSettings.provider, provider));
}

export async function recordIntegrationTest(provider: IntegrationProvider, ok: boolean, message: string) {
  const db = getDb();
  await db
    .insert(integrationSettings)
    .values({ provider, lastTestedAt: new Date(), lastTestOk: ok, lastTestMessage: message })
    .onConflictDoUpdate({
      target: integrationSettings.provider,
      set: { lastTestedAt: new Date(), lastTestOk: ok, lastTestMessage: message },
    });
}
