import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { can } from "@/server/auth/rbac";
import { listRuns } from "@/server/agents/runner";
import { deepseekConfig } from "@/server/integrations/deepseek";
import { listInvoices } from "@/server/services/invoice";
import { listVendors } from "@/server/services/vendor";
import { AgentChat, AgentRunForm } from "@/components/agents/run-form";
import { RunCard } from "@/components/agents/run-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "AI agents" };
export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const user = await requireAction("agents.run");
  const [cfg, runs, invoices, vendors] = await Promise.all([deepseekConfig(), listRuns(30), listInvoices(), listVendors()]);
  const canApply = can(user.role, "agents.apply");
  const disabled = !cfg.enabled;
  return (
    <>
      <PageHeader
        eyebrow="Agentic processes"
        title="AI agents"
        subtitle="DeepSeek reads live ERP data through the same tool registry as the external API, then proposes. Nothing is written until a person clicks Apply — every run, tool call and decision is logged."
        actions={<><Badge tone={cfg.enabled ? "ok" : "warn"}>{cfg.mock ? "Mock mode" : cfg.enabled ? `DeepSeek · ${cfg.model}` : "Not configured"}</Badge>{can(user.role, "settings.manage") ? <Button href="/settings/integrations" variant="secondary" size="sm">Configure</Button> : null}</>}
      />
      {disabled ? <Alert tone="warn" title="DeepSeek is not configured" className="mb-5">Add a DeepSeek API key under Settings → Integrations (or set DEEPSEEK_API_KEY) to enable the agents.</Alert> : null}
      <div className="mb-5"><AgentChat disabled={disabled} /></div>
      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AgentRunForm kind="draft_po" invoices={[]} vendors={[]} disabled={disabled} />
        <AgentRunForm kind="reorder" invoices={[]} vendors={[]} disabled={disabled} />
        <AgentRunForm kind="invoice_match" invoices={invoices.filter((i) => i.poId).map((i) => ({ id: i.id, label: `${i.invoiceNumber} · ${i.vendor.name} · ${i.status}` }))} vendors={[]} disabled={disabled} />
        <AgentRunForm kind="vendor_risk" invoices={[]} vendors={vendors.map((v) => ({ id: v.id, label: v.name }))} disabled={disabled} />
      </div>
      <h2 className="mb-3 text-[15px] font-semibold">Run history</h2>
      <ul className="space-y-2">
        {runs.map((r) => <RunCard key={r.id} run={r} canApply={canApply} />)}
        {runs.length === 0 ? <li className="text-[13.5px] text-ink-faint">No runs yet.</li> : null}
      </ul>
    </>
  );
}
