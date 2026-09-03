"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { resetAction, type AuthState } from "@/server/actions/auth";

export function ResetForm({ token, isInvite }: { token: string; isInvite: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(resetAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div>
        <p className="text-[11.5px] font-medium uppercase text-sky">{isInvite ? "Welcome" : "Account recovery"}</p>
        <h1 className="mt-1 text-[28px] font-semibold">{isInvite ? "Set your password" : "Choose a new password"}</h1>
        <p className="mt-2 text-[14px] text-ink-soft">At least 10 characters with upper-case, lower-case and digits.</p>
      </div>
      {state.error ? <Alert tone="bad">{state.error}</Alert> : null}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="new-password" required autoFocus minLength={10} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {isInvite ? "Set password and sign in" : "Update password and sign in"}
      </Button>
    </form>
  );
}
