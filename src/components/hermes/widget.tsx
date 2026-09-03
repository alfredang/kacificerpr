"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string };

/* Floating Hermes chat, bottom-right. Talks to /api/agents/chat (session auth);
   the same agent answers on Telegram when the bot is configured. */
export function HermesWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ telegram: string | null; enabled: boolean; canRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || meta) return;
    fetch("/api/agents/chat")
      .then((r) => r.json())
      .then((d) => {
        setMsgs(d.history ?? []);
        setMeta({ telegram: d.telegram, enabled: d.enabled, canRun: d.canRun });
      })
      .catch(() => setMeta({ telegram: null, enabled: false, canRun: false }));
  }, [open, meta]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setError(null);
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: t }]);
    setBusy(true);
    try {
      const res = await fetch("/api/agents/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Request failed");
      setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: d.reply + (d.hasProposal ? "\n\n→ Review it under AI agents." : "") }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3" data-testid="hermes-widget">
      {open ? (
        <section className="flex h-[520px] w-[360px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-card border border-line bg-white shadow-lift" aria-label="Hermes agent chat">
          <header className="flex items-center gap-3 bg-blue-footer px-4 py-3 text-white">
            <span className="flex size-8 items-center justify-center rounded-full bg-white/15"><Bot className="size-4" /></span>
            <div className="flex-1">
              <p className="text-[13.5px] font-semibold">Hermes</p>
              <p className="text-[11px] text-white/75">{meta?.enabled ? "Kacific ERP agent · live data" : "Agent not configured"}</p>
            </div>
            {meta?.telegram ? (
              <a href={meta.telegram} target="_blank" rel="noopener" className="inline-flex items-center gap-1 rounded-pill bg-white/15 px-2.5 py-1 text-[11px] font-medium hover:bg-white/25" title="Open in Telegram">
                Telegram <ExternalLink className="size-3" />
              </a>
            ) : null}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-full p-1 hover:bg-white/15"><X className="size-4" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-tint/50 px-4 py-3 text-[13px]">
            {msgs.length === 0 ? (
              <div className="rounded-card bg-white p-3 text-ink-soft shadow-card">
                Ask me about stock, purchase orders, vendors or invoices. Try: <em>“How many Gigstarter kits are in Suva?”</em>, <em>“Status of PO-2026-0012?”</em>, <em>“Raise a PO for 50 LNBs to Manila.”</em>
              </div>
            ) : null}
            {msgs.map((m) => (
              <div key={m.id} className={cn("max-w-[85%] whitespace-pre-line rounded-card px-3 py-2 shadow-card", m.role === "user" ? "ml-auto bg-blue text-white" : "bg-white text-ink")}>{m.content}</div>
            ))}
            {busy ? <div className="w-fit rounded-card bg-white px-3 py-2 text-ink-faint shadow-card">Thinking…</div> : null}
            {error ? <div className="rounded-card bg-bad-bg px-3 py-2 text-bad-fg">{error}</div> : null}
            <div ref={bottom} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2 border-t border-line px-3 py-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={meta && !meta.canRun ? "Your role cannot use the agent" : "Message Hermes…"}
              disabled={busy || (meta ? !meta.canRun || !meta.enabled : false)}
              aria-label="Message Hermes"
              className="flex-1 rounded-pill border border-line-strong px-3 py-2 text-[13px] focus:border-blue focus:outline-none"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex size-9 items-center justify-center rounded-full bg-blue text-white disabled:opacity-40"><Send className="size-4" /></button>
          </form>
          <p className="border-t border-line px-3 py-1.5 text-[10.5px] text-ink-faint">Hermes reads live data and proposes; people approve. Full runs on the <Link href="/agents" className="text-blue hover:underline">AI agents</Link> page.</p>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close Hermes chat" : "Open Hermes chat"}
        className="flex items-center gap-2 rounded-pill bg-blue px-4 py-3 text-[13px] font-medium uppercase text-white shadow-lift transition-colors hover:bg-blue-deep"
      >
        <Bot className="size-5" /> {open ? "Close" : "Hermes"}
      </button>
    </div>
  );
}
