import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { rateLimit } from "@/server/security/rate-limit";
import { chatHistory, hermesReply } from "@/server/services/chat";
import { telegramConfig } from "@/server/integrations/telegram";
import { deepseekConfig } from "@/server/integrations/deepseek";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Session-authenticated endpoint behind the in-app Hermes widget. Same-origin
   only (cookie + Origin check) — external agents use /api/v1 instead. */
function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  return origin === req.nextUrl.origin || origin === (process.env.APP_URL ?? "").replace(/\/$/, "");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const [history, tg, ds] = await Promise.all([chatHistory({ userId: user.id }), telegramConfig(), deepseekConfig()]);
  return NextResponse.json({ history: history.map((m) => ({ id: m.id, role: m.role, content: m.content, at: m.createdAt })), telegram: tg.enabled && tg.botUsername ? `https://t.me/${tg.botUsername}` : null, enabled: ds.enabled, canRun: can(user.role, "agents.run") });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "bad origin" }, { status: 403 });
  if (!can(user.role, "agents.run")) return NextResponse.json({ error: "Your role cannot use the agent" }, { status: 403 });
  const rl = await rateLimit(`chat:${user.id}`, 30, 10 * 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Slow down — 30 messages per 10 minutes" }, { status: 429 });
  const parsed = z.object({ text: z.string().trim().min(1).max(2000) }).safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Say something first" }, { status: 422 });
  const r = await hermesReply({ channel: "widget", user, text: parsed.data.text });
  return NextResponse.json(r);
}
