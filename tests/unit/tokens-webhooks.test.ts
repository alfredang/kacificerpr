import { describe, expect, it } from "vitest";
import { signPayload } from "@/server/webhooks/deliver";
import { hmacSha256 } from "@/server/security/crypto";
import { passwordPolicy } from "@/server/security/password";

describe("webhook signing", () => {
  it("signs timestamp.body with HMAC-SHA256", () => {
    const sig = signPayload("whsec_x", "1700000000", '{"a":1}');
    expect(sig).toBe(`sha256=${hmacSha256("whsec_x", '1700000000.{"a":1}')}`);
    expect(signPayload("whsec_y", "1700000000", '{"a":1}')).not.toBe(sig);
  });
});

describe("password policy", () => {
  it("requires length and character mix", () => {
    expect(passwordPolicy("short1A")).toMatch(/10 characters/);
    expect(passwordPolicy("alllowercase1")).toMatch(/Mix/);
    expect(passwordPolicy("Kacific2026!")).toBeNull();
  });
});
