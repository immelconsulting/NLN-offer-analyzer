import { describe, it, expect } from "vitest";
import { createSession, verifySession, safeEqual } from "../api/_lib/auth.js";

describe("admin sessions", () => {
  const secret = "test-secret";
  it("accepts its own signed session", () => {
    expect(verifySession(createSession(secret), secret)).toBe(true);
  });
  it("rejects a forged, tampered, wrong-key or expired session", () => {
    const s = createSession(secret);
    expect(verifySession("forged.signature", secret)).toBe(false);
    expect(verifySession(s.replace(/.$/, s.endsWith("A") ? "B" : "A"), secret)).toBe(false);
    expect(verifySession(s, "other-secret")).toBe(false);
    expect(verifySession(createSession(secret, Date.now() - 30 * 86400000), secret)).toBe(false);
    expect(verifySession(undefined, secret)).toBe(false);
  });
  it("compares secrets safely", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
