import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/constants";

/* Optimistic gate: a request without a valid session JWT never reaches the
   app segment. The DB check (active, session_version) happens in requireUser()
   on the server — the proxy stays DB-free. */
const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/approvals", "/api/health", "/api/auth", "/api/v1", "/api/cron", "/api/webhooks", "/dev"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let valid = false;
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET), { algorithms: ["HS256"] });
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.png|kacific-logo.png|favicon.ico).*)"],
};
