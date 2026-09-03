import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

/* Fixed-window counter in Postgres — serverless has no shared memory. Expired
   rows are swept opportunistically on every write. */
export async function rateLimit(key: string, limit: number, windowMs: number) {
  const db = getDb();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} < now() THEN ${resetAt} ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning();
  if (Math.random() < 0.05) {
    await db.delete(rateLimits).where(sql`${rateLimits.resetAt} < now()`);
  }
  const allowed = row.count <= limit;
  return { allowed, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}
