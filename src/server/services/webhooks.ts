import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { inboundWebhooks, webhookDeliveries, webhookEndpoints } from "@/db/schema";
import type { WebhookEvent } from "@/lib/constants";
import { encrypt, randomToken } from "@/server/security/crypto";
import { emit } from "@/server/events";
import { deliverMany } from "@/server/webhooks/deliver";
import { audit, type Actor } from "./audit";

export async function listEndpoints() {
  return getDb().query.webhookEndpoints.findMany({ orderBy: [desc(webhookEndpoints.createdAt)], with: { deliveries: { orderBy: [desc(webhookDeliveries.createdAt)], limit: 10 } } });
}

export async function createEndpoint(input: { name: string; url: string; events: WebhookEvent[]; enabled: boolean }, actor: Actor) {
  const secret = `whsec_${randomToken(24)}`;
  const [row] = await getDb()
    .insert(webhookEndpoints)
    .values({ ...input, secretCiphertext: encrypt(secret), inboundKey: randomToken(16), createdBy: actor.id ?? null })
    .returning();
  await audit({ actor, action: "webhook.create", entityType: "webhook_endpoint", entityId: row.id, payload: { url: input.url, events: input.events } });
  return { row, secret };
}

export async function updateEndpoint(id: string, input: { name: string; url: string; events: WebhookEvent[]; enabled: boolean }, actor: Actor) {
  const [row] = await getDb().update(webhookEndpoints).set({ ...input, updatedAt: new Date() }).where(eq(webhookEndpoints.id, id)).returning();
  await audit({ actor, action: "webhook.update", entityType: "webhook_endpoint", entityId: id, payload: { url: input.url, enabled: input.enabled } });
  return row;
}

export async function deleteEndpoint(id: string, actor: Actor) {
  await getDb().delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
  await audit({ actor, action: "webhook.delete", entityType: "webhook_endpoint", entityId: id });
}

export async function sendTestEvent(id: string, actor: Actor) {
  const db = getDb();
  const [row] = await db.insert(webhookDeliveries).values({ endpointId: id, event: "test.ping", payload: { message: "Hello from Kacific ERP", sentBy: actor.label, at: new Date().toISOString() } }).returning();
  await deliverMany([row.id]);
  return db.query.webhookDeliveries.findFirst({ where: eq(webhookDeliveries.id, row.id) });
}

export async function recordInbound(source: string, endpointId: string | null, headers: Record<string, string>, payload: unknown, verified: boolean) {
  const [row] = await getDb().insert(inboundWebhooks).values({ source, endpointId, headers, payload, verified }).returning();
  return row;
}

export async function listInbound(limit = 20) {
  return getDb().select().from(inboundWebhooks).orderBy(desc(inboundWebhooks.createdAt)).limit(limit);
}

export { emit };
