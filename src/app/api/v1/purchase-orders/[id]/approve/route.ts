import { z } from "zod";
import { withApi, ok, jsonBody, ApiError } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";
import { decidePo, getPo } from "@/server/services/po";

export const dynamic = "force-dynamic";

export const POST = withApi({ scope: "approve:po", action: "po.approve" }, async ({ principal, req, onBehalfOf }, params) => {
  const po = await getPo(params.id);
  if (!po) throw new ApiError(404, "Purchase order not found", "not_found");
  const body = await jsonBody(req, z.object({ note: z.string().max(1000).optional() }));
  await decidePo(po.id, "approve", { actor: { type: "api_key", id: principal.keyId, label: `API key ${principal.name}${onBehalfOf ? ` for ${onBehalfOf}` : ""}` }, role: principal.user.role, note: body.note, approverId: principal.user.id, via: "api" });
  return ok(await runTool("get_purchase_order", { idOrNumber: po.id }));
});
