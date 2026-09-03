import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { purchaseOrders } from "@/db/schema";
import { hmacSha256, safeEqual } from "@/server/security/crypto";
import { recordInbound } from "@/server/services/webhooks";
import { decidePo } from "@/server/services/po";
import { getAsanaTask } from "@/server/integrations/asana";

export const dynamic = "force-dynamic";

/* Asana webhook receiver. The handshake echoes X-Hook-Secret; every later
   delivery is verified with HMAC-SHA256 of the raw body using that secret
   (stored as ASANA_WEBHOOK_SECRET). A task completed in Asana approves the PO. */
export async function POST(req: NextRequest) {
  const handshake = req.headers.get("x-hook-secret");
  if (handshake) {
    await recordInbound("asana:handshake", null, { "x-hook-secret": "received" }, {}, true);
    return new NextResponse(null, { status: 200, headers: { "x-hook-secret": handshake } });
  }
  const raw = await req.text();
  const secret = process.env.ASANA_WEBHOOK_SECRET ?? "";
  const sig = req.headers.get("x-hook-signature") ?? "";
  const verified = Boolean(secret) && safeEqual(sig, hmacSha256(secret, raw));
  let payload: { events?: { resource?: { gid: string; resource_type: string }; action?: string; change?: { field?: string } }[] } = {};
  try {
    payload = JSON.parse(raw);
  } catch {}
  await recordInbound("asana", null, { "x-hook-signature": sig ? "present" : "absent" }, payload, verified);
  if (!verified) return NextResponse.json({ ok: false, error: "signature" }, { status: 401 });
  let applied = 0;
  for (const ev of payload.events ?? []) {
    if (ev.resource?.resource_type !== "task" || ev.action !== "changed" || ev.change?.field !== "completed") continue;
    const po = await getDb().query.purchaseOrders.findFirst({ where: eq(purchaseOrders.asanaTaskGid, ev.resource.gid) });
    if (!po || po.status !== "pending_approval") continue;
    const task = await getAsanaTask(ev.resource.gid);
    if (task?.completed) {
      await decidePo(po.id, "approve", { actor: { type: "system", label: "Asana webhook" }, role: "admin", note: "Task completed in Asana", approverId: null, via: "asana" });
      applied += 1;
    }
  }
  return NextResponse.json({ ok: true, applied });
}
