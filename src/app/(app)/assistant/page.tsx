import type { Metadata } from "next";
import { requireAction } from "@/server/auth/session";
import { deepseekConfig } from "@/server/integrations/deepseek";
import { AssistantChat } from "@/components/assistant/chat";
import { Alert, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Data assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  await requireAction("agents.run");
  const cfg = await deepseekConfig();
  return (
    <>
      <PageHeader
        eyebrow="Read-only"
        title="Data assistant"
        subtitle="Ask about purchase orders, invoices, vendors, SKUs and stock. Answers are read live from the database through the same tool registry as the API — this assistant can only read, never write."
      />
      {!cfg.enabled ? (
        <Alert tone="warn" title="DeepSeek is not configured" className="mb-5">
          Add a DeepSeek API key under Settings → Integrations (or set DEEPSEEK_API_KEY) to enable the assistant.
        </Alert>
      ) : null}
      <AssistantChat disabled={!cfg.enabled} />
    </>
  );
}
