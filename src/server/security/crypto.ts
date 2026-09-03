import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* AES-256-GCM for secrets at rest (integration keys, webhook secrets). The
   ciphertext is versioned (`v1:`) so the key can be rotated later without a
   flag day. The key is APP_ENCRYPTION_KEY, base64, 32 bytes. */
function key(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) throw new Error("APP_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    // Accept any string by hashing it — but a real 32-byte key is what production should use.
    return createHash("sha256").update(raw).digest();
  }
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decrypt(ciphertext: string): string {
  const [v, ivB64, tagB64, dataB64] = ciphertext.split(":");
  if (v !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Unrecognised ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function last4(s: string) {
  return s.length <= 4 ? s : s.slice(-4);
}
