import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import type { Role } from "@/lib/constants";
import { hashPassword } from "@/server/security/password";
import { audit, type Actor } from "./audit";
import { sendInvite } from "./auth";

export async function listUsers() {
  const now = Date.now();
  const rows = await getDb().select().from(users).where(eq(users.isServiceAccount, false)).orderBy(asc(users.name));
  return rows.map((u) => ({ ...u, locked: Boolean(u.lockedUntil && u.lockedUntil.getTime() > now) }));
}

export async function inviteUser(input: { email: string; name: string; role: Role }, actor: Actor, inviterName: string) {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({ email: input.email.toLowerCase(), name: input.name, role: input.role })
    .returning();
  await audit({ actor, action: "user.invite", entityType: "user", entityId: row.id, payload: { email: row.email, role: row.role } });
  await sendInvite(row.id, inviterName);
  return row;
}

export async function updateUser(id: string, patch: { name?: string; role?: Role; isActive?: boolean }, actor: Actor) {
  const db = getDb();
  const before = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!before) throw new Error("User not found");
  const bump = (patch.role && patch.role !== before.role) || patch.isActive === false;
  const [row] = await db
    .update(users)
    .set({ ...patch, ...(bump ? { sessionVersion: sql`${users.sessionVersion} + 1` } : {}), updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  await audit({ actor, action: "user.update", entityType: "user", entityId: id, payload: { before: { role: before.role, isActive: before.isActive }, after: patch } });
  return row;
}

export async function setPasswordDirect(id: string, password: string, actor: Actor) {
  const db = getDb();
  await db.update(users).set({ passwordHash: await hashPassword(password), sessionVersion: sql`${users.sessionVersion} + 1`, failedLogins: 0, lockedUntil: null }).where(eq(users.id, id));
  await audit({ actor, action: "user.password_set", entityType: "user", entityId: id });
}
