"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, getCurrentUser, requestIp } from "@/server/auth/session";
import { login, requestPasswordReset, resetPassword } from "@/server/services/auth";
import { passwordPolicy } from "@/server/security/password";
import { forgotSchema, loginSchema, resetSchema } from "@/server/validation/auth";
import { audit } from "@/server/services/audit";

export type AuthState = { error?: string; ok?: boolean; fields?: Record<string, string> };

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email address and password." };
  const result = await login(parsed.data.email, parsed.data.password, await requestIp());
  if (!result.ok) return { error: "Those details did not match an active account. Check them and try again." };
  await createSession(result.user);
  redirect(safeNext(parsed.data.next));
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: { type: "user", id: user.id, label: user.email }, action: "auth.logout", entityType: "user", entityId: user.id });
  await destroySession();
  redirect("/login");
}

export async function forgotAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email address." };
  await requestPasswordReset(parsed.data.email, await requestIp());
  return { ok: true };
}

export async function resetAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message === "Passwords do not match" ? issue.message : "Use at least 10 characters and make both fields match." };
  }
  const policy = passwordPolicy(parsed.data.password);
  if (policy) return { error: policy };
  const r = await resetPassword(parsed.data.token, parsed.data.password, await requestIp());
  if (!r.ok) return { error: "This link is no longer valid. Request a new one." };
  await createSession(r.user);
  redirect("/dashboard");
}
