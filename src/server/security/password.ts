import { hash, verify } from "@node-rs/argon2";

/* argon2id with OWASP-recommended parameters (m=19 MiB, t=2, p=1). */
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false;
  }
}

export function passwordPolicy(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) {
    return "Mix upper-case, lower-case and digits.";
  }
  return null;
}
