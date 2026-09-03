import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookDeliveries, webhookEndpoints } from "@/db/schema";
import { decrypt, hmacSha256 } from "@/server/security/crypto";

/* Retry schedule after a failed attempt (attempt 1 → 1 min … attempt 5 → 12 h). */
const RETRY_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000];
const TIMEOUT_MS = 5_000;

export function signPayload(secret: string, timestamp: string, body: string) {
  return `sha256=${hmacSha256(secret, `${timestamp}.${body}`)}`;
}

export async function deliverOne(deliveryId: string) {
  const db = getDb();
  const delivery = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.id, deliveryId),
    with: { endpoint: true },
  });
  if (!delivery || !delivery.endpoint) return;
  const endpoint = delivery.endpoint;
  const attempt = delivery.attempt + 1;
  const body = JSON.stringify({
    id: delivery.id,
    event: delivery.event,
    createdAt: delivery.createdAt.toISOString(),
    attempt,
    data: delivery.payload,
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const started = Date.now();
  let code: number | null = null;
  let text = "";
  let ok = false;
  if (process.env.INTEGRATIONS_MOCK === "1" || endpoint.url.startsWith("mock://")) {
    ok = true;
    code = 200;
    text = "mocked";
  } else {
    try {
      const res = await fetch(endpoint.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Kacific-ERP-Webhooks/1.0",
          "x-kacific-event": delivery.event,
          "x-kacific-delivery": delivery.id,
          "x-kacific-timestamp": timestamp,
          "x-kacific-signature": signPayload(decrypt(endpoint.secretCiphertext), timestamp, body),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      code = res.status;
      text = (await res.text()).slice(0, 2000);
      ok = res.ok;
    } catch (err) {
      text = err instanceof Error ? err.message : String(err);
    }
  }
  const responseMs = Date.now() - started;
  const exhausted = !ok && attempt >= RETRY_MS.length;
  await db
    .update(webhookDeliveries)
    .set({
      attempt,
      status: ok ? "delivered" : exhausted ? "exhausted" : "failed",
      responseCode: code,
      responseMs,
      responseBody: text,
      deliveredAt: ok ? new Date() : null,
      nextRetryAt: ok || exhausted ? null : new Date(Date.now() + RETRY_MS[attempt - 1]),
    })
    .where(eq(webhookDeliveries.id, deliveryId));
  return ok;
}

export async function deliverMany(ids: string[]) {
  await Promise.allSettled(ids.map((id) => deliverOne(id)));
}

/* Called by the webhook_retry scheduled task. */
export async function retryDue(limit = 50) {
  const db = getDb();
  const due = await db
    .select({ id: webhookDeliveries.id })
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.status, "failed"), isNotNull(webhookDeliveries.nextRetryAt), lte(webhookDeliveries.nextRetryAt, new Date())))
    .limit(limit);
  await deliverMany(due.map((d) => d.id));
  return due.length;
}

export async function endpointsFor(event: string) {
  const db = getDb();
  const all = await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.enabled, true));
  return all.filter((e) => e.events.includes(event));
}

export async function redeliver(ids: string[]) {
  const db = getDb();
  await db.update(webhookDeliveries).set({ status: "pending", nextRetryAt: null }).where(inArray(webhookDeliveries.id, ids));
  await deliverMany(ids);
}
