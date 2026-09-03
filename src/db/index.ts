import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as PgPool } from "pg";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/* One driver switch for every target: node-postgres for local Docker, Homebrew
   or any self-hosted Postgres; Neon's WebSocket Pool for *.neon.tech (the HTTP
   driver cannot run the interactive transactions PO numbering and stock receipt
   depend on). The pool is cached on globalThis so dev HMR does not leak
   connections, and it is created lazily so importing this module at build time
   never opens a socket. */
function resolveDriver(url: string): "pg" | "neon" {
  const forced = process.env.DB_DRIVER;
  if (forced === "pg" || forced === "neon") return forced;
  return /\.neon\.tech/i.test(url) ? "neon" : "pg";
}

const globalForDb = globalThis as unknown as { __kacificDb?: Db; __kacificDriver?: string };

export function getDb(): Db {
  if (globalForDb.__kacificDb) return globalForDb.__kacificDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const driver = resolveDriver(url);
  let db: Db;
  if (driver === "neon") {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: url });
    db = drizzleNeon(pool, { schema }) as unknown as Db;
  } else {
    const pool = new PgPool({ connectionString: url, max: 10 });
    db = drizzlePg(pool, { schema });
  }
  globalForDb.__kacificDb = db;
  globalForDb.__kacificDriver = driver;
  return db;
}

export function dbDriver() {
  return globalForDb.__kacificDriver ?? resolveDriver(process.env.DATABASE_URL ?? "");
}

export { schema };
