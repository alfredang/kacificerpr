import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";
import type { ApiScope, Role } from "@/lib/constants";
import { randomToken, safeEqual, sha256 } from "@/server/security/crypto";
import { audit, type Actor } from "./audit";

const PREFIX = "kfc_live_";

export async function listApiKeys() {
  return getDb().query.apiKeys.findMany({ with: { serviceUser: { columns: { name: true, role: true, email: true } } }, orderBy: [desc(apiKeys.createdAt)] });
}

/* The raw key is returned exactly once; only its SHA-256 is stored. Each key is
   bound to a service-account user so RBAC applies to API calls the same way. */
export async function createApiKey(input: { name: string; scopes: ApiScope[]; role: Role; expiresAt?: Date | null }, actor: Actor, createdBy: string) {
  const db = getDb();
  const raw = `${PREFIX}${randomToken(24)}`;
  const prefix = raw.slice(0, PREFIX.length + 8);
  const [svc] = await db
    .insert(users)
    .values({ email: `svc+${randomToken(6).toLowerCase()}@api.kacific.local`, name: `API: ${input.name}`, role: input.role, isServiceAccount: true })
    .returning();
  const [row] = await db
    .insert(apiKeys)
    .values({ name: input.name, prefix, keyHash: sha256(raw), scopes: input.scopes, serviceUserId: svc.id, createdBy, expiresAt: input.expiresAt ?? null })
    .returning();
  await audit({ actor, action: "api_key.create", entityType: "api_key", entityId: row.id, payload: { name: input.name, scopes: input.scopes, role: input.role } });
  return { raw, row };
}

export async function revokeApiKey(id: string, actor: Actor) {
  const db = getDb();
  const [row] = await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)).returning();
  if (row) {
    await db.update(users).set({ isActive: false }).where(eq(users.id, row.serviceUserId));
    await audit({ actor, action: "api_key.revoke", entityType: "api_key", entityId: id });
  }
}

export type ApiPrincipal = { keyId: string; name: string; scopes: ApiScope[]; user: typeof users.$inferSelect };

export async function authenticateApiKey(raw: string): Promise<ApiPrincipal | null> {
  if (!raw.startsWith(PREFIX)) return null;
  const db = getDb();
  const prefix = raw.slice(0, PREFIX.length + 8);
  const candidates = await db.query.apiKeys.findMany({ where: and(eq(apiKeys.prefix, prefix), isNull(apiKeys.revokedAt)), with: { serviceUser: true } });
  const hash = sha256(raw);
  for (const k of candidates) {
    if (!safeEqual(k.keyHash, hash)) continue;
    if (k.expiresAt && k.expiresAt.getTime() < Date.now()) return null;
    if (!k.serviceUser.isActive) return null;
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, k.id));
    return { keyId: k.id, name: k.name, scopes: k.scopes as ApiScope[], user: k.serviceUser };
  }
  return null;
}
