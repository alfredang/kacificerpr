import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, type User } from "@/db/schema";
import { runAgent } from "@/server/agents/runner";
import type { AgentKind } from "@/lib/constants";

export type ChatChannel = "widget" | "telegram" | "assistant";

/* The Hermes conversation layer used by the in-app floating widget, the
   Telegram bot and the read-only Data assistant page: store the user's
   message, run the appropriate agent kind, store the reply. */
export async function chatHistory(where: { channel: ChatChannel; userId?: string; externalChatId?: string }, limit = 30) {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(where.userId ? and(eq(chatMessages.channel, where.channel), eq(chatMessages.userId, where.userId)) : and(eq(chatMessages.channel, where.channel), eq(chatMessages.externalChatId, where.externalChatId ?? "")))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function hermesReply(input: { channel: ChatChannel; kind?: AgentKind; user: User | null; externalChatId?: string; text: string }) {
  const db = getDb();
  await db.insert(chatMessages).values({ channel: input.channel, userId: input.user?.id ?? null, externalChatId: input.externalChatId ?? null, role: "user", content: input.text });
  const run = await runAgent(input.kind ?? "chat", { prompt: input.text }, input.user?.id ?? null);
  const proposal = run.proposal as { lines?: unknown[] } | null;
  let reply = run.status === "failed" ? `Sorry — ${run.error ?? "I could not complete that."}` : run.summary || "Done.";
  if (proposal?.lines) reply += `\n\nI have drafted a purchase-order proposal. A person needs to review and apply it on the AI agents page (run ${run.id.slice(0, 8)}).`;
  await db.insert(chatMessages).values({ channel: input.channel, userId: input.user?.id ?? null, externalChatId: input.externalChatId ?? null, role: "assistant", content: reply, runId: run.id });
  return { reply, runId: run.id, status: run.status, hasProposal: Boolean(proposal?.lines) };
}
