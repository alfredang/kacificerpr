import { getDb, type Tx } from "@/db";
import { poEvents, webhookDeliveries } from "@/db/schema";
import type { WebhookEvent } from "@/lib/constants";
import type { Actor } from "./services/audit";
import { deliverMany, endpointsFor } from "./webhooks/deliver";

/* The event bus. Every domain event (a) is written to the PO's own timeline
   when it concerns a PO and (b) fans out to subscribed webhook endpoints.
   Delivery is attempted immediately, best-effort; failures fall back to the
   retry sweep run by the scheduler. */
export async function recordPoEvent(
  entry: {
    poId: string;
    type: string;
    actor: Actor;
    message?: string;
    meta?: Record<string, unknown>;
  },
  tx?: Tx,
) {
  const db = tx ?? getDb();
  await db.insert(poEvents).values({
    poId: entry.poId,
    type: entry.type,
    actorType: entry.actor.type,
    actorId: entry.actor.id ?? null,
    actorLabel: entry.actor.label,
    message: entry.message ?? "",
    meta: entry.meta ?? {},
  });
}

export async function emit(event: WebhookEvent, payload: Record<string, unknown>) {
  const endpoints = await endpointsFor(event);
  if (endpoints.length === 0) return [];
  const db = getDb();
  const rows = await db
    .insert(webhookDeliveries)
    .values(endpoints.map((e) => ({ endpointId: e.id, event, payload })))
    .returning({ id: webhookDeliveries.id });
  const ids = rows.map((r) => r.id);
  await deliverMany(ids);
  return ids;
}
