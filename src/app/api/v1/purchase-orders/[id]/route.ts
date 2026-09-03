import { withApi, ok } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";

export const dynamic = "force-dynamic";

export const GET = withApi({ scope: "read:po" }, async (_ctx, params) => ok(await runTool("get_purchase_order", { idOrNumber: params.id })));
