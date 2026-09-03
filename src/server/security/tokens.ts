import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Tx } from "@/db";
import { oneTimeTokens } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";

export type TokenPurpose = "password_reset" | "po_approve" | "po_reject" | "invite";

/* Raw tokens are handed out once (in an email) and only their SHA-256 is stored.
   Consumption is a single UPDATE … WHERE used_at IS NULL so two clicks cannot
   both succeed. */
export async function issueToken(
  purpose: TokenPurpose,
  opts: { userId?: string | null; poId?: string | null; ttlMs: number },
  tx?: Tx,
) {
  const raw = randomToken(32);
  const db = tx ?? getDb();
  await db.insert(oneTimeTokens).values({
    tokenHash: sha256(raw),
    purpose,
    userId: opts.userId ?? null,
    poId: opts.poId ?? null,
    expiresAt: new Date(Date.now() + opts.ttlMs),
  });
  return raw;
}

export async function peekToken(raw: string, purpose: TokenPurpose) {
  const db = getDb();
  const row = await db.query.oneTimeTokens.findFirst({
    where: and(eq(oneTimeTokens.tokenHash, sha256(raw)), eq(oneTimeTokens.purpose, purpose)),
  });
  if (!row) return { ok: false as const, reason: "invalid" as const };
  if (row.usedAt) return { ok: false as const, reason: "used" as const };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
  return { ok: true as const, token: row };
}

export async function consumeToken(raw: string, purpose: TokenPurpose, ip: string | null, tx?: Tx) {
  const db = tx ?? getDb();
  const [row] = await db
    .update(oneTimeTokens)
    .set({ usedAt: new Date(), usedIp: ip })
    .where(and(eq(oneTimeTokens.tokenHash, sha256(raw)), eq(oneTimeTokens.purpose, purpose), isNull(oneTimeTokens.usedAt)))
    .returning();
  if (!row) return { ok: false as const, reason: "invalid" as const };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false as const, reason: "expired" as const };
  return { ok: true as const, token: row };
}

/* Approve/reject twins share a PO — consuming either voids the other. */
export async function voidPoTokens(poId: string, tx?: Tx) {
  const db = tx ?? getDb();
  await db
    .update(oneTimeTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(oneTimeTokens.poId, poId), isNull(oneTimeTokens.usedAt)));
}
