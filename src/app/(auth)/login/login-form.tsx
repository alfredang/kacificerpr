"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { loginAction, type AuthState } from "@/server/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <p className="text-[11.5px] font-medium uppercase text-sky">Welcome back</p>
        <h1 className="mt-1 text-[28px] font-semibold">Sign in to Kacific ERP</h1>
      </div>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus placeholder="you@kacific.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div className="flex items-center justify-between">
        <Link href="/forgot-password" className="text-[13px] text-blue hover:underline">
          Forgot your password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
      <p className="text-center text-[12px] text-ink-faint">Access is by invitation. Ask an administrator if you need an account.</p>
    </form>
  );
}
