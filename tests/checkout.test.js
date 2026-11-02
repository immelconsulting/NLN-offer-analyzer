import { describe, it, expect, beforeEach } from "vitest";
import { checkoutUrl, rememberAnalysis, rememberedAnalysis } from "../src/lib/checkoutUrl.js";
import { encodeResult, decodeResult } from "../src/lib/encodeResult.js";

const LINK = "https://buy.stripe.com/test_abc";
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
};

describe("checkoutUrl: the payment carries the analysis id and email", () => {
  beforeEach(() => store.clear());

  it("adds client_reference_id and prefilled_email", () => {
    store.set("nln:lead", JSON.stringify({ email: "pat+1@example.com" }));
    const u = new URL(checkoutUrl(LINK, { submissionId: "sub_1792150000000_ab12cd" }));
    expect(u.searchParams.get("client_reference_id")).toBe("sub_1792150000000_ab12cd");
    expect(u.searchParams.get("prefilled_email")).toBe("pat+1@example.com");
  });

  it("leaves off a reference Stripe would reject, and still works with no lead", () => {
    const u = new URL(checkoutUrl(LINK, { submissionId: "has spaces!" }));
    expect(u.searchParams.has("client_reference_id")).toBe(false);
    expect(u.searchParams.has("prefilled_email")).toBe(false);
  });

  it("never breaks checkout on a bad link", () => {
    expect(checkoutUrl("not a url")).toBe("not a url");
  });
});

describe("encodeResult / decodeResult", () => {
  it("round-trips non-ASCII text (names, en dashes, emoji)", () => {
    const data = { form: { role: "Ingénieure – Lead 🚀", location: "Montréal" }, analysis: { offerScore: 70 } };
    expect(decodeResult(encodeResult(data))).toEqual(data);
  });
  it("produces a URL-safe string", () => {
    expect(encodeResult({ x: "?&=/+" })).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("session links name the latest analysis", () => {
  const local = new Map();
  beforeEach(() => {
    local.clear();
    globalThis.localStorage = {
      getItem: (k) => (local.has(k) ? local.get(k) : null),
      setItem: (k, v) => local.set(k, String(v)),
    };
  });

  it("remembers it and sends it as the reference", () => {
    rememberAnalysis("sub_1792150000000_ab12cd");
    const u = new URL(checkoutUrl(LINK, { submissionId: rememberedAnalysis() }));
    expect(u.searchParams.get("client_reference_id")).toBe("sub_1792150000000_ab12cd");
  });

  it("still works with nothing remembered, or no storage at all", () => {
    expect(new URL(checkoutUrl(LINK, { submissionId: rememberedAnalysis() })).searchParams.has("client_reference_id")).toBe(false);
    globalThis.localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(() => rememberAnalysis("x")).not.toThrow();
    expect(rememberedAnalysis()).toBeUndefined();
  });
});
