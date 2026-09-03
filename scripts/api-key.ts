import "./_env";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users } from "../src/db/schema";
import { createApiKey } from "../src/server/services/api-keys";
import { API_SCOPES, type ApiScope, type Role } from "../src/lib/constants";

/* pnpm api-key "Hermes agent" procurement read:stock,read:po,write:po
   Mints a scoped API key bound to a service-account role and prints it once. */
async function main() {
  const [name = "Hermes agent", role = "procurement", scopeArg = "read:stock,read:vendors,read:po,write:po,read:invoices"] = process.argv.slice(2);
  const scopes = scopeArg.split(",").map((s) => s.trim()).filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s));
  if (scopes.length === 0) throw new Error(`No valid scopes. Choose from: ${API_SCOPES.join(", ")}`);
  const db = getDb();
  const admin = await db.query.users.findFirst({ where: eq(users.role, "admin") });
  if (!admin) throw new Error("Seed the database first (pnpm db:seed)");
  const { raw, row } = await createApiKey({ name, role: role as Role, scopes }, { type: "user", id: admin.id, label: "CLI" }, admin.id);
  console.log(`\nAPI key "${row.name}" (role ${role}, scopes ${scopes.join(" ")}):\n\n  ${raw}\n\nCopy it now — only its hash is stored.\n`);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
