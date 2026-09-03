import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { getCompanySettings } from "@/server/services/settings";
import { CompanyForm, PurgeDemoForm } from "@/components/settings/forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/misc";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const user = await requireAction("settings.view");
  const s = await getCompanySettings();
  return (
    <div className="space-y-5">
    <Card>
      <CardHeader title="Company profile" subtitle="Numbering, approval threshold and match tolerance drive the procurement rules." />
      <CardBody>
        {can(user.role, "settings.manage") ? (
          <CompanyForm s={s} />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Company" value={s.name} /><Stat label="Legal name" value={s.legalName} /><Stat label="Timezone" value={s.timezone} /><Stat label="Currency" value={s.currency} />
            <Stat label="PO prefix" value={s.poPrefix} /><Stat label="Next PO #" value={String(s.nextPoSeq)} /><Stat label="Auto-approve under" value={s.approvalThreshold ? money(s.approvalThreshold) : "off"} /><Stat label="Price tolerance" value={`${s.priceTolerancePct}%`} />
          </div>
        )}
      </CardBody>
    </Card>
    {can(user.role, "settings.manage") ? (
      <Card className="border-bad-fg/30">
        <CardHeader title="Danger zone — demo data" subtitle="Start from a clean database before entering real vendors, SKUs and orders" />
        <CardBody><PurgeDemoForm /></CardBody>
      </Card>
    ) : null}
    </div>
  );
}
