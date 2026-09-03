import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { emailOutbox } from "@/db/schema";
import { dateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/* Dev-only outbox viewer: the only place raw approval / reset links surface.
   Hard 404 in production. */
export default async function MailboxPage() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_MAILBOX !== "1") notFound();
  const rows = await getDb().select().from(emailOutbox).orderBy(desc(emailOutbox.createdAt)).limit(50);
  return (
    <div className="mx-auto max-w-4xl p-8">
      <p className="text-[11.5px] font-medium uppercase text-sky">Development</p>
      <h1 className="text-[26px] font-semibold">Email outbox</h1>
      <p className="mt-1 text-[13.5px] text-ink-soft">Last 50 emails recorded by the app. Transport column shows whether Resend actually sent it.</p>
      <ul className="mt-6 space-y-4">
        {rows.map((m) => (
          <li key={m.id} className="rounded-card border border-line bg-white p-4 shadow-card" data-testid="mail">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{m.subject}</p>
              <p className="text-[12px] text-ink-faint">
                {dateTime(m.createdAt)} · {m.sentVia}
                {m.error ? ` · error: ${m.error}` : ""}
              </p>
            </div>
            <p className="text-[13px] text-ink-soft">To: {m.to}</p>
            {m.links.length ? (
              <ul className="mt-2 space-y-1 text-[13px]">
                {m.links.map((l) => (
                  <li key={l}>
                    <a className="break-all text-blue hover:underline" href={l}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <details className="mt-2 text-[12.5px]">
              <summary className="cursor-pointer text-ink-faint">Preview</summary>
              <iframe title={m.subject} srcDoc={m.html} className="mt-2 h-96 w-full rounded-card border border-line" sandbox="" />
            </details>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-ink-faint">Nothing sent yet.</li> : null}
      </ul>
    </div>
  );
}
