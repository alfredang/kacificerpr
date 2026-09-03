import { resolveIntegration } from "@/server/services/settings";
import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_MODELS } from "@/lib/constants";

/* DeepSeek exposes an OpenAI-compatible Chat Completions API. We call it with
   plain fetch — no SDK — so the tool-calling loop is fully under our control
   and auditable. Models: deepseek-v4-pro / deepseek-v4-flash (1M context, tool
   calling in both thinking and non-thinking mode). In thinking mode every
   assistant turn's `reasoning_content` must be echoed back with the tool
   results or the API returns 400 — the runner does that. */
const BASE = "https://api.deepseek.com";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type ChatResult = {
  message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[]; reasoning_content?: string };
  usage: { prompt_tokens: number; completion_tokens: number };
  model: string;
};

export type Thinking = "disabled" | "low" | "high";

export function normaliseModel(id?: string | null) {
  const known = DEEPSEEK_MODELS.map((m) => m.id as string);
  if (id && known.includes(id)) return id;
  // Legacy names (deepseek-chat / deepseek-reasoner) were retired; map them forward.
  return id === "deepseek-reasoner" ? "deepseek-v4-pro" : DEEPSEEK_DEFAULT_MODEL;
}

export async function deepseekConfig() {
  const cfg = await resolveIntegration("deepseek");
  return {
    enabled: cfg.enabled || process.env.AI_MOCK === "1",
    apiKey: cfg.secret,
    model: normaliseModel(cfg.config.model),
    thinking: (["disabled", "low", "high"].includes(cfg.config.thinking) ? cfg.config.thinking : "disabled") as Thinking,
    mock: process.env.AI_MOCK === "1",
  };
}

export async function chat(
  messages: ChatMessage[],
  opts: { tools?: ToolDef[]; temperature?: number; apiKey?: string; model?: string; jsonMode?: boolean; thinking?: Thinking } = {},
): Promise<ChatResult> {
  const cfg = await deepseekConfig();
  const apiKey = opts.apiKey ?? cfg.apiKey;
  const model = normaliseModel(opts.model ?? cfg.model);
  const thinking = opts.thinking ?? cfg.thinking;
  if (!apiKey) throw new Error("DeepSeek is not configured. Add an API key in Settings → Integrations.");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      // Thinking mode ignores temperature; non-thinking uses it.
      ...(thinking === "disabled" ? { thinking: { type: "disabled" }, temperature: opts.temperature ?? 0.2 } : { thinking: { type: "enabled" }, reasoning_effort: thinking }),
      ...(opts.tools && opts.tools.length ? { tools: opts.tools, tool_choice: "auto" } : {}),
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    choices?: { message: ChatResult["message"] }[];
    usage?: ChatResult["usage"];
    model?: string;
    error?: { message: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? `DeepSeek ${res.status}`);
  const message = json.choices?.[0]?.message;
  if (!message) throw new Error("DeepSeek returned no choices");
  return { message, usage: json.usage ?? { prompt_tokens: 0, completion_tokens: 0 }, model: json.model ?? model };
}

export async function testDeepseek(apiKey: string, model = DEEPSEEK_DEFAULT_MODEL) {
  try {
    const r = await chat([{ role: "user", content: "Reply with the single word OK." }], { apiKey, model, temperature: 0, thinking: "disabled" });
    return { ok: true, message: `Connected · model ${r.model} · reply “${(r.message.content ?? "").trim().slice(0, 20)}”` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
