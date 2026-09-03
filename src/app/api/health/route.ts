import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, dbDriver } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: dbDriver(), time: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "db unreachable" }, { status: 503 });
  }
}
