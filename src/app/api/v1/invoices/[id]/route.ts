import { withApi, ok } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";

export const dynamic = "force-dynamic";

export const GET = withApi({ scope: "read:invoices" }, async ({ req }, params) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  void q; void params;
  return ok(await runTool("get_invoice", { id: params.id }));
});
