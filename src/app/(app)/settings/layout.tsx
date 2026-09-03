import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { PageHeader } from "@/components/ui/misc";
import { SettingsTabs } from "@/components/settings/tabs";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAction("settings.view");
  return (
    <>
      <PageHeader eyebrow="Administration" title="Company settings" subtitle="Company profile, people and roles, integrations, external API keys, scheduled tasks and webhooks." />
      <SettingsTabs canManage={can(user.role, "settings.manage")} />
      {children}
    </>
  );
}
