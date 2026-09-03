import "./_env";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { getDb, dbDriver } from "../src/db";

async function main() {
  const db = getDb();
  const driver = dbDriver();
  console.log(`Applying migrations with the ${driver} driver…`);
  if (driver === "neon") {
    await migrateNeon(db as never, { migrationsFolder: "./drizzle" });
  } else {
    await migratePg(db, { migrationsFolder: "./drizzle" });
  }
  console.log("Migrations applied.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
