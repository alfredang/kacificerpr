import { describe, expect, it } from "vitest";
import { decrypt, encrypt, hmacSha256, safeEqual, sha256 } from "@/server/security/crypto";

describe("crypto", () => {
  it("round-trips AES-GCM with a versioned ciphertext", () => {
    const c = encrypt("sk-secret-value");
    expect(c.startsWith("v1:")).toBe(true);
    expect(decrypt(c)).toBe("sk-secret-value");
    expect(encrypt("x")).not.toBe(encrypt("x"));
  });
  it("detects tampering", () => {
    const c = encrypt("hello");
    const parts = c.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
  it("hashes and compares in constant time", () => {
    expect(sha256("a")).toHaveLength(64);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
    expect(hmacSha256("k", "m")).toHaveLength(64);
  });
});
