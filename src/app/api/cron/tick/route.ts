import { NextResponse, type NextRequest } from "next/server";
import { safeEqual } from "@/server/security/crypto";
import { runDueTasks } from "@/server/services/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Vercel Cron (and the Docker sidecar / pnpm cron:tick) hit this every 5 min.
   Authorization: Bearer $CRON_SECRET — Vercel injects the header itself. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const ran = await runDueTasks("cron");
  return NextResponse.json({ ok: true, ran, at: new Date().toISOString() });
}
