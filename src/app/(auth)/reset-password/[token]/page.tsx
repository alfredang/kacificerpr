import Link from "next/link";
import { checkResetToken } from "@/server/services/auth";
import { Alert } from "@/components/ui/misc";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const check = await checkResetToken(token);
  if (!check.ok) {
    return (
      <div className="space-y-5">
        <h1 className="text-[28px] font-semibold">This link cannot be used</h1>
        <Alert tone="warn">
          {check.reason === "expired" ? "The link has expired." : check.reason === "used" ? "The link has already been used." : "The link is not valid."} Request a new
          one from the sign-in page.
        </Alert>
        <Link href="/forgot-password" className="text-[13px] text-blue hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }
  return <ResetForm token={token} isInvite={check.token.purpose === "invite"} />;
}
