import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import type { ApiScope } from "@/lib/constants";
import { authenticateApiKey, type ApiPrincipal } from "@/server/services/api-keys";
import { rateLimit } from "@/server/security/rate-limit";
import { audit } from "@/server/services/audit";
import { can, type Action } from "@/server/auth/rbac";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "error") {
    super(message);
  }
}

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, error: null, meta: meta ?? {} }, { status });
}

export function fail(status: number, message: string, code = "error") {
  return NextResponse.json({ data: null, error: { code, message } }, { status });
}

type Ctx = { principal: ApiPrincipal; ip: string | null; req: NextRequest; onBehalfOf: string | null };

/* Bearer key → scope → RBAC → rate limit → handler → audit. Cookie sessions are
   deliberately NOT accepted here: the external API is for agents and
   integrations, and it must never be reachable with an ambient browser session. */
export function withApi(opts: { scope: ApiScope; action?: Action }, handler: (ctx: Ctx, params: Record<string, string>) => Promise<Response>) {
  return async (req: NextRequest, route?: { params: Promise<Record<string, string>> }) => {
    const auth = req.headers.get("authorization") ?? "";
    const raw = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!raw) return fail(401, "Missing Bearer API key", "unauthenticated");
    const principal = await authenticateApiKey(raw);
    if (!principal) return fail(401, "Invalid, expired or revoked API key", "unauthenticated");
    if (!principal.scopes.includes(opts.scope)) return fail(403, `This key lacks the ${opts.scope} scope`, "forbidden");
    if (opts.action && !can(principal.user.role, opts.action)) return fail(403, `The key's role (${principal.user.role}) cannot ${opts.action}`, "forbidden");
    const rl = await rateLimit(`api:${principal.keyId}`, 60, 60_000);
    if (!rl.allowed) return fail(429, "Rate limit exceeded (60 requests / minute)", "rate_limited");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
    const onBehalfOf = principal.scopes.includes("impersonate") ? req.headers.get("x-on-behalf-of") : null;
    const params = route ? await route.params : {};
    try {
      const res = await handler({ principal, ip, req, onBehalfOf }, params);
      await audit({ actor: { type: "api_key", id: principal.keyId, label: `API key ${principal.name}` }, action: "api.call", entityType: "api", entityId: `${req.method} ${req.nextUrl.pathname}`, ip, payload: { status: res.status, onBehalfOf } });
      return res;
    } catch (err) {
      if (err instanceof ApiError) return fail(err.status, err.message, err.code);
      if (err instanceof z.ZodError) return fail(422, err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation");
      const message = err instanceof Error ? err.message : "Internal error";
      const status = /not found/i.test(message) ? 404 : /cannot|only|must|role/i.test(message) ? 409 : 500;
      if (status === 500) console.error(err);
      return fail(status, status === 500 ? "Internal error" : message, status === 409 ? "conflict" : status === 404 ? "not_found" : "error");
    }
  };
}

export async function jsonBody<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const body = await req.json().catch(() => ({}));
  return schema.parse(body);
}
