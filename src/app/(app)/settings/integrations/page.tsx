import { requireAction } from "@/server/auth/session";
import { getIntegration } from "@/server/services/settings";
import { IntegrationCard } from "@/components/settings/forms";
import { Alert } from "@/components/ui/misc";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requireAction("settings.manage");
  const [resend, deepseek, asana, telegram] = await Promise.all([getIntegration("resend"), getIntegration("deepseek"), getIntegration("asana"), getIntegration("telegram")]);
  return (
    <div className="space-y-5">
      <Alert tone="info">Keys saved here are encrypted at rest with the server&apos;s <code>APP_ENCRYPTION_KEY</code> and take precedence over environment variables. Only the last four characters are ever shown.</Alert>
      <IntegrationCard i={deepseek} />
      <IntegrationCard i={asana} />
      <IntegrationCard i={resend} />
      <IntegrationCard i={telegram} />
    </div>
  );
}
