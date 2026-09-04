import { getDb } from "@/db";
import { emailOutbox } from "@/db/schema";
import { resolveIntegration } from "@/server/services/settings";

export type Mail = { to: string | string[]; subject: string; html: string; links?: string[] };

/* Transport order: INTEGRATIONS_MOCK / EMAIL_TRANSPORT=outbox|console win, then
   Resend when enabled in Settings (or via RESEND_API_KEY). Every email is
   written to email_outbox regardless, which doubles as the audit trail and as
   the dev mailbox Playwright reads links from. */
export async function sendEmail(mail: Mail) {
  const db = getDb();
  const to = Array.isArray(mail.to) ? mail.to.join(", ") : mail.to;
  const forced = process.env.INTEGRATIONS_MOCK === "1" ? "outbox" : process.env.EMAIL_TRANSPORT;
  let via = forced && forced !== "resend" ? forced : "resend";
  let providerId: string | null = null;
  let error: string | null = null;

  if (via === "resend") {
    const resend = await resolveIntegration("resend");
    if (!resend.enabled || !resend.secret) {
      via = "outbox";
    } else {
      try {
        const { Resend } = await import("resend");
        const client = new Resend(resend.secret);
        const res = await client.emails.send({
          from: resend.config.from || process.env.EMAIL_FROM || "Kacific ERP <onboarding@resend.dev>",
          to: Array.isArray(mail.to) ? mail.to : [mail.to],
          subject: mail.subject,
          html: mail.html,
        });
        if (res.error) error = res.error.message;
        providerId = res.data?.id ?? null;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
    }
  }
  if (via === "console") {
    console.log(`[email → ${to}] ${mail.subject}\n${(mail.links ?? []).join("\n")}`);
  }
  await db.insert(emailOutbox).values({
    to,
    subject: mail.subject,
    html: mail.html,
    links: mail.links ?? [],
    sentVia: via,
    providerId,
    error,
  });
  return { via, providerId, error };
}

/* Settings → Integrations "Send test email": proves outbound delivery end to
   end (not just that the API key is valid) by routing a real message through
   the same sendEmail() transport every other email in the app uses. */
export async function sendTestEmail(to: string) {
  return sendEmail({
    to,
    subject: "Kacific ERP — test email",
    html: shell(
      "Test email",
      `<p>This is a test email from Kacific ERP, sent from Settings → Integrations to confirm outbound email delivery is working.</p>
       <p style="font-size:13px;color:#616161">Sent ${new Date().toISOString()}.</p>`,
    ),
  });
}

/* ------------------------------------------------------------ templates */
const shell = (title: string, body: string) => `
<div style="font-family:Montserrat,Segoe UI,Arial,sans-serif;max-width:600px;margin:0 auto;color:#111">
  <div style="background:#07529e;color:#fff;padding:20px 24px;border-radius:5px 5px 0 0">
    <div style="font-size:12px;letter-spacing:0;opacity:.85">Kacific ERP</div>
    <h1 style="margin:6px 0 0;font-size:20px;font-weight:600">${title}</h1>
  </div>
  <div style="border:1px solid #e3e8ef;border-top:0;padding:24px;border-radius:0 0 5px 5px;font-size:15px;line-height:1.5">
    ${body}
    <p style="color:#767676;font-size:12px;margin-top:28px">This message was sent by Kacific ERP. Links are single-use and expire.</p>
  </div>
</div>`;

const button = (href: string, label: string, color = "#034ea2") =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:500;text-transform:uppercase;font-size:13px;padding:12px 22px;border-radius:38px;margin:6px 8px 6px 0">${label}</a>`;

export function approvalRequestEmail(p: {
  poNumber: string;
  requester: string;
  vendor: string;
  total: string;
  lines: { description: string; qty: number; lineTotal: string }[];
  approveUrl: string;
  rejectUrl: string;
  viewUrl: string;
  neededBy?: string | null;
}) {
  const rows = p.lines
    .map((l) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e3e8ef">${l.description}</td><td style="padding:6px 8px;border-bottom:1px solid #e3e8ef;text-align:right">${l.qty}</td><td style="padding:6px 8px;border-bottom:1px solid #e3e8ef;text-align:right">${l.lineTotal}</td></tr>`)
    .join("");
  return {
    subject: `Approval needed: ${p.poNumber} · ${p.vendor} · ${p.total}`,
    html: shell(
      `Purchase order ${p.poNumber} needs your approval`,
      `<p><strong>${p.requester}</strong> has submitted a purchase order to <strong>${p.vendor}</strong> for <strong>${p.total}</strong>${p.neededBy ? `, needed by ${p.neededBy}` : ""}.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin:12px 0"><thead><tr><th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cfd7e2">Item</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #cfd7e2">Qty</th><th style="text-align:right;padding:6px 8px;border-bottom:2px solid #cfd7e2">Total</th></tr></thead><tbody>${rows}</tbody></table>
       <p>${button(p.approveUrl, "Approve", "#1a6b39")}${button(p.rejectUrl, "Reject", "#a12525")}</p>
       <p style="font-size:13px;color:#616161">Or open it in the ERP: <a href="${p.viewUrl}">${p.viewUrl}</a></p>`,
    ),
    links: [p.approveUrl, p.rejectUrl, p.viewUrl],
  };
}

export function decisionEmail(p: { poNumber: string; decision: "approved" | "rejected"; approver: string; note: string; viewUrl: string }) {
  return {
    subject: `${p.poNumber} was ${p.decision}`,
    html: shell(
      `${p.poNumber} ${p.decision}`,
      `<p><strong>${p.approver}</strong> has <strong>${p.decision}</strong> purchase order ${p.poNumber}.</p>${p.note ? `<p>Note: ${p.note}</p>` : ""}<p>${button(p.viewUrl, "View purchase order")}</p>`,
    ),
    links: [p.viewUrl],
  };
}

export function passwordResetEmail(p: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your Kacific ERP password",
    html: shell(
      "Reset your password",
      `<p>Hi ${p.name},</p><p>Someone asked to reset the password for this account. If that was you, choose a new password within 30 minutes:</p><p>${button(p.resetUrl, "Choose a new password")}</p><p style="font-size:13px;color:#616161">If you did not ask for this, you can ignore this email — your password will not change.</p>`,
    ),
    links: [p.resetUrl],
  };
}

export function inviteEmail(p: { name: string; inviter: string; setupUrl: string; role: string }) {
  return {
    subject: "You have been invited to Kacific ERP",
    html: shell(
      "Welcome to Kacific ERP",
      `<p>Hi ${p.name},</p><p>${p.inviter} has created an account for you with the <strong>${p.role}</strong> role. Set your password to get started:</p><p>${button(p.setupUrl, "Set my password")}</p>`,
    ),
    links: [p.setupUrl],
  };
}

export function digestEmail(p: { title: string; intro: string; items: string[]; viewUrl: string; cta: string }) {
  return {
    subject: p.title,
    html: shell(
      p.title,
      `<p>${p.intro}</p><ul>${p.items.map((i) => `<li>${i}</li>`).join("")}</ul><p>${button(p.viewUrl, p.cta)}</p>`,
    ),
    links: [p.viewUrl],
  };
}
