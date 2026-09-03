import { withApi, ok, ApiError } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";
import { getPo, submitPo } from "@/server/services/po";

export const dynamic = "force-dynamic";

export const POST = withApi({ scope: "write:po", action: "po.submit" }, async ({ principal }, params) => {
  const po = await getPo(params.id);
  if (!po) throw new ApiError(404, "Purchase order not found", "not_found");
  await submitPo(po.id, principal.user);
  return ok(await runTool("get_purchase_order", { idOrNumber: po.id }));
});
