"use client";

import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { id: string; role: string; content: string };

/* Full-page read-only Data assistant. Talks to /api/agents/assistant (session
   auth); the "assistant" agent kind has no propose_* tools, so it can only
   read and report — never write. */
export function AssistantChat({ disabled }: { disabled: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<{ enabled: boolean; canRun: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agents/assistant")
      .then((r) => r.json())
      .then((d) => {
        setMsgs(d.history ?? []);
        setMeta({ enabled: d.enabled, canRun: d.canRun });
      })
      .catch(() => setMeta({ enabled: false, canRun: false }));
  }, []);

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
      const res = await fetch("/api/agents/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Request failed");
      setMsgs((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: d.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  const blocked = disabled || (meta ? !meta.canRun || !meta.enabled : false);

  return (
    <section data-testid="assistant-chat" className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-card border border-line bg-white shadow-card">
      <div className="flex-1 space-y-3 overflow-y-auto bg-tint/50 px-4 py-3 text-[13px]">
        {msgs.length === 0 ? (
          <div className="mx-auto mt-6 max-w-xl rounded-card bg-white p-4 text-ink-soft shadow-card">
            Ask me anything about your ERP data — stock, purchase orders, invoices, vendors and KPIs. Try: <em>“How many SKUs are below reorder level?”</em>, <em>“Status of PO-2026-0001?”</em>, <em>“Which vendors are in Singapore?”</em>
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
          placeholder={disabled ? "Assistant not configured" : meta && !meta.canRun ? "Your role cannot use the assistant" : "Ask about stock, POs, vendors or invoices…"}
          disabled={busy || blocked}
          aria-label="Message the data assistant"
          className="flex-1 rounded-pill border border-line-strong px-3 py-2 text-[13px] focus:border-blue focus:outline-none"
        />
        <button type="submit" disabled={busy || !text.trim() || blocked} aria-label="Send" className="flex size-9 items-center justify-center rounded-full bg-blue text-white disabled:opacity-40">
          <Send className="size-4" />
        </button>
      </form>
    </section>
  );
}
