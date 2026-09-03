"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { forgotAction, type AuthState } from "@/server/actions/auth";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(forgotAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <p className="text-[11.5px] font-medium uppercase text-sky">Account recovery</p>
        <h1 className="mt-1 text-[28px] font-semibold">Reset your password</h1>
        <p className="mt-2 text-[14px] text-ink-soft">Enter your work email. If it matches an account, we will send a single-use link that expires in 30 minutes.</p>
      </div>
      {state.ok ? (
        <Alert tone="ok" title="Check your inbox">If that address belongs to an account, a reset link is on its way.</Alert>
      ) : null}
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Send reset link
      </Button>
      <p className="text-center text-[13px]">
        <Link href="/login" className="text-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
