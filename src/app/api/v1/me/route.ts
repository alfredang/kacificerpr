import { withApi, ok } from "@/server/api/v1";

export const dynamic = "force-dynamic";

export const GET = withApi({ scope: "read:po" }, async ({ principal, onBehalfOf }) =>
  ok({ key: principal.name, role: principal.user.role, scopes: principal.scopes, onBehalfOf }),
);
