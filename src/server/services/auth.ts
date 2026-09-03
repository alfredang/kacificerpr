import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { INVITE_TOKEN_TTL_HOURS, RESET_TOKEN_TTL_MINUTES } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/server/security/password";
import { rateLimit } from "@/server/security/rate-limit";
import { consumeToken, issueToken, peekToken } from "@/server/security/tokens";
import { inviteEmail, passwordResetEmail, sendEmail } from "@/server/integrations/email";
import { audit } from "./audit";

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/* Every failure path returns the same generic result so the login page cannot
   be used to enumerate accounts or lockout state. */
export async function login(email: string, password: string, ip: string | null) {
  const normalised = email.trim().toLowerCase();
  const rl = await rateLimit(`login:${ip ?? "?"}:${normalised}`, Number(process.env.LOGIN_RATE_LIMIT ?? 5), 15 * 60_000);
  if (!rl.allowed) {
    await audit({ actor: { type: "system", label: "System" }, action: "auth.rate_limited", entityType: "user", ip });
    return { ok: false as const };
  }
  const db = getDb();
  const user = await db.query.users.findFirst({ where: and(eq(users.email, normalised), eq(users.isServiceAccount, false)) });
  if (!user || !user.passwordHash || !user.isActive) {
    // Burn the same time as a real verify so timing does not leak existence.
    await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", password);
    return { ok: false as const };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.login_locked", entityType: "user", entityId: user.id, ip });
    return { ok: false as const };
  }
  const good = await verifyPassword(user.passwordHash, password);
  if (!good) {
    const failed = user.failedLogins + 1;
    await db
      .update(users)
      .set({ failedLogins: failed, lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null })
      .where(eq(users.id, user.id));
    await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.login_failed", entityType: "user", entityId: user.id, ip });
    return { ok: false as const };
  }
  const [fresh] = await db
    .update(users)
    .set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();
  await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.login", entityType: "user", entityId: user.id, ip });
  return { ok: true as const, user: fresh };
}

export async function requestPasswordReset(email: string, ip: string | null) {
  const normalised = email.trim().toLowerCase();
  const rl = await rateLimit(`forgot:${ip ?? "?"}`, 5, 15 * 60_000);
  if (!rl.allowed) return;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: and(eq(users.email, normalised), eq(users.isActive, true)) });
  if (!user) return; // same response either way
  const raw = await issueToken("password_reset", { userId: user.id, ttlMs: RESET_TOKEN_TTL_MINUTES * 60_000 });
  const mail = passwordResetEmail({ name: user.name, resetUrl: appUrl(`/reset-password/${raw}`) });
  await sendEmail({ to: user.email, ...mail });
  await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.reset_requested", entityType: "user", entityId: user.id, ip });
}

export async function checkResetToken(raw: string) {
  const r = await peekToken(raw, "password_reset");
  if (!r.ok) {
    const r2 = await peekToken(raw, "invite");
    return r2;
  }
  return r;
}

export async function resetPassword(raw: string, newPassword: string, ip: string | null) {
  const db = getDb();
  return db.transaction(async (tx) => {
    let r = await consumeToken(raw, "password_reset", ip, tx);
    if (!r.ok) r = await consumeToken(raw, "invite", ip, tx);
    if (!r.ok || !r.token.userId) return { ok: false as const, reason: r.ok ? "invalid" : r.reason };
    const passwordHash = await hashPassword(newPassword);
    // Bumping session_version signs every existing session out.
    const [user] = await tx
      .update(users)
      .set({ passwordHash, failedLogins: 0, lockedUntil: null, sessionVersion: (await tx.query.users.findFirst({ where: eq(users.id, r.token.userId) }))!.sessionVersion + 1 })
      .where(eq(users.id, r.token.userId))
      .returning();
    await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.password_reset", entityType: "user", entityId: user.id, ip }, tx);
    return { ok: true as const, user };
  });
}

export async function sendInvite(userId: string, inviterName: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  const raw = await issueToken("invite", { userId: user.id, ttlMs: INVITE_TOKEN_TTL_HOURS * 3_600_000 });
  const mail = inviteEmail({ name: user.name, inviter: inviterName, role: user.role, setupUrl: appUrl(`/reset-password/${raw}`) });
  await sendEmail({ to: user.email, ...mail });
}
