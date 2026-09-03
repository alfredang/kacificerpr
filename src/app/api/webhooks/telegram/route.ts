import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { safeEqual } from "@/server/security/crypto";
import { rateLimit } from "@/server/security/rate-limit";
import { sendTelegramMessage, telegramConfig } from "@/server/integrations/telegram";
import { hermesReply } from "@/server/services/chat";
import { recordInbound } from "@/server/services/webhooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Telegram → Hermes. Only chat ids listed under Settings → Integrations →
   Telegram may talk to the bot; everyone else is told their chat id so an
   admin can allow it. Requests are checked against the webhook secret token. */
export async function POST(req: NextRequest) {
  const cfg = await telegramConfig();
  if (!cfg.enabled || !cfg.token) return NextResponse.json({ ok: false, error: "telegram disabled" }, { status: 404 });
  const header = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (cfg.webhookSecret && !safeEqual(header, cfg.webhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  const update = (await req.json().catch(() => null)) as { message?: { chat: { id: number; type: string }; from?: { first_name?: string; username?: string }; text?: string } } | null;
  const msg = update?.message;
  if (!msg?.text) return NextResponse.json({ ok: true, ignored: true });
  const chatId = String(msg.chat.id);
  await recordInbound("telegram", null, { from: msg.from?.username ?? "" }, { chatId, text: msg.text.slice(0, 500) }, true);
  const rl = await rateLimit(`tg:${chatId}`, 20, 10 * 60_000);
  if (!rl.allowed) return NextResponse.json({ ok: true, rateLimited: true });
  if (!cfg.allowed.includes(chatId)) {
    await sendTelegramMessage(cfg.token, chatId, `Hi ${msg.from?.first_name ?? "there"} — this bot is restricted to Kacific ERP staff. Your chat id is ${chatId}; ask an administrator to add it under Settings → Integrations → Telegram.`);
    return NextResponse.json({ ok: true, denied: true });
  }
  if (/^\/start/.test(msg.text)) {
    await sendTelegramMessage(cfg.token, chatId, "Hermes here. Ask me about stock, purchase orders, vendors or invoices — e.g. “How many Gigstarter kits are in Suva?” or “Status of PO-2026-0012?”. I can draft POs for a person to approve in the ERP.");
    return NextResponse.json({ ok: true });
  }
  // Telegram users act as the shared "Hermes (Telegram)" service identity; proposals still need a human to apply in the ERP.
  const bot = await getDb().query.users.findFirst({ where: eq(users.email, "hermes-telegram@api.kacific.local") });
  const r = await hermesReply({ channel: "telegram", user: bot ?? null, externalChatId: chatId, text: msg.text });
  await sendTelegramMessage(cfg.token, chatId, r.reply);
  return NextResponse.json({ ok: true, runId: r.runId });
}
