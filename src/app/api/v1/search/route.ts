import { withApi, ok } from "@/server/api/v1";
import { runTool } from "@/server/agents/tools";

export const dynamic = "force-dynamic";

export const GET = withApi({ scope: "read:po" }, async ({ req }, params) => {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  void q; void params;
  return ok(await runTool("search", { q: q.q ?? "" }));
});
