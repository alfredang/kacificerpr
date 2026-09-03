import { resolveIntegration } from "@/server/services/settings";

/* Telegram Bot API client for the Hermes chatbot. The bot token is stored
   encrypted in Settings → Integrations (or TELEGRAM_BOT_TOKEN). */
const API = "https://api.telegram.org";

export async function telegramConfig() {
  const cfg = await resolveIntegration("telegram");
  const allowed = (cfg.config.allowedChatIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { enabled: cfg.enabled, token: cfg.secret, botUsername: cfg.config.botUsername ?? "", allowed, webhookSecret: cfg.config.webhookSecret ?? "" };
}

async function call<T>(token: string, method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) throw new Error(json.description ?? `Telegram ${res.status}`);
  return json.result as T;
}

export async function sendTelegramMessage(token: string, chatId: string | number, text: string) {
  if (process.env.INTEGRATIONS_MOCK === "1") return;
  // Telegram caps messages at 4096 chars; plain text avoids Markdown escaping pitfalls.
  for (let i = 0; i < text.length; i += 4000) {
    await call(token, "sendMessage", { chat_id: chatId, text: text.slice(i, i + 4000), disable_web_page_preview: true });
  }
}

export async function testTelegram(token: string, config: Record<string, string>) {
  try {
    const me = await call<{ username: string; first_name: string }>(token, "getMe", {});
    let webhook = "";
    const base = process.env.APP_URL ?? "";
    if (base.startsWith("https://")) {
      await call(token, "setWebhook", { url: `${base}/api/webhooks/telegram`, secret_token: config.webhookSecret || undefined, allowed_updates: ["message"] });
      webhook = ` · webhook set to ${base}/api/webhooks/telegram`;
    } else {
      webhook = " · webhook not set (APP_URL must be https)";
    }
    return { ok: true, message: `Connected as @${me.username} (${me.first_name})${webhook}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
