import { getDb, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

export type Actor = {
  type: "user" | "api_key" | "agent" | "system" | "token";
  id?: string | null;
  label: string;
};

export const SYSTEM_ACTOR: Actor = { type: "system", id: null, label: "System" };

export async function audit(
  entry: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId?: string | null;
    ip?: string | null;
    payload?: Record<string, unknown>;
  },
  tx?: Tx,
) {
  const db = tx ?? getDb();
  await db.insert(auditLog).values({
    actorType: entry.actor.type,
    actorId: entry.actor.id ?? null,
    actorLabel: entry.actor.label,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    ip: entry.ip ?? null,
    payload: entry.payload ?? {},
  });
}
