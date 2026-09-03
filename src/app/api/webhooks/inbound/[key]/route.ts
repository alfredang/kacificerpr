import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEndpoints } from "@/db/schema";
import { decrypt, hmacSha256, safeEqual } from "@/server/security/crypto";
import { recordInbound } from "@/server/services/webhooks";
import { rateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

/* Generic inbound receiver: each endpoint has an inbound key in its URL and
   an optional X-Kacific-Signature (HMAC of the body with the endpoint secret).
   Payloads are stored for later automation; nothing is mutated automatically. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const rl = await rateLimit(`inbound:${key}`, 120, 60_000);
  if (!rl.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const endpoint = await getDb().query.webhookEndpoints.findFirst({ where: eq(webhookEndpoints.inboundKey, key) });
  if (!endpoint || !endpoint.enabled) return NextResponse.json({ ok: false, error: "unknown endpoint" }, { status: 404 });
  const raw = await req.text();
  const sig = req.headers.get("x-kacific-signature") ?? "";
  const ts = req.headers.get("x-kacific-timestamp") ?? "";
  const verified = Boolean(sig) && safeEqual(sig, `sha256=${hmacSha256(decrypt(endpoint.secretCiphertext), `${ts}.${raw}`)}`);
  let payload: unknown = raw;
  try {
    payload = JSON.parse(raw);
  } catch {}
  const row = await recordInbound(endpoint.name, endpoint.id, { "content-type": req.headers.get("content-type") ?? "", "x-kacific-signature": sig ? "present" : "absent" }, payload, verified);
  return NextResponse.json({ ok: true, id: row.id, verified });
}
