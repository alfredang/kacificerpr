import "./_env";
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";

/* Drops the public schema (dev/e2e only) so migrate + seed start clean. */
async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DB_RESET !== "1") {
    throw new Error("Refusing to reset a production database (set ALLOW_DB_RESET=1 to override)");
  }
  const db = getDb();
  await db.execute(sql`DROP SCHEMA public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  console.log("Database reset. Run pnpm db:migrate && pnpm db:seed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
