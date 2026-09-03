import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, type Role } from "@/lib/constants";
import { can, type Action } from "./rbac";

export type SessionUser = Pick<User, "id" | "email" | "name" | "role">;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET must be set (32+ random bytes)");
  return new TextEncoder().encode(s);
}

/* JWT in an httpOnly cookie. The payload carries session_version so a password
   reset, role change or deactivation invalidates every live session on the
   next request — requireUser() compares it against the users row. */
export async function createSession(user: User) {
  const jwt = await new SignJWT({ role: user.role, sv: user.sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { userId: payload.sub, role: payload.role as Role, sv: Number(payload.sv ?? 0) };
  } catch {
    return null;
  }
}

/* Cached per request so layouts, pages and actions share one DB lookup. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, claims.userId) });
  if (!user || !user.isActive || user.sessionVersion !== claims.sv) return null;
  return user;
});

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class ForbiddenError extends Error {
  constructor(action: string) {
    super(`Forbidden: ${action}`);
    this.name = "ForbiddenError";
  }
}

export async function requireAction(action: Action): Promise<User> {
  const user = await requireUser();
  if (!can(user.role, action)) throw new ForbiddenError(action);
  return user;
}

export async function requestIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}
