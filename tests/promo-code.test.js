import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ sessionRetrieve: null, promoRetrieve: null }));
vi.mock("stripe", () => ({
  default: class {
    checkout = { sessions: { retrieve: (...a) => h.sessionRetrieve(...a) } };
    promotionCodes = { retrieve: (...a) => h.promoRetrieve(...a) };
  },
}));
vi.spyOn(console, "error").mockImplementation(() => {});

const { promoCodeUsed, UNKNOWN_DISCOUNT } = await import("../api/_lib/payment.js");
const discounted = { id: "cs_1", total_details: { amount_discount: 4606 } };

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test";
  h.sessionRetrieve = vi.fn(async () => ({}));
  h.promoRetrieve = vi.fn(async () => ({ code: "NLNVIP98" }));
});

describe("which promo code a sale used", () => {
  it("makes no Stripe calls when there was no discount", async () => {
    expect(await promoCodeUsed({ id: "cs_1", total_details: { amount_discount: 0 } })).toBeUndefined();
    expect(await promoCodeUsed(undefined)).toBeUndefined();
    expect(h.sessionRetrieve).not.toHaveBeenCalled();
    expect(h.promoRetrieve).not.toHaveBeenCalled();
  });

  it("reads the code from the session's discounts", async () => {
    const code = await promoCodeUsed({ ...discounted, discounts: [{ coupon: null, promotion_code: "promo_1" }] });
    expect(code).toBe("NLNVIP98");
    expect(h.promoRetrieve).toHaveBeenCalledWith("promo_1");
  });

  it("falls back to the total's breakdown", async () => {
    h.sessionRetrieve = vi.fn(async () => ({
      total_details: { breakdown: { discounts: [{ discount: { promotion_code: "promo_2" } }] } },
    }));
    expect(await promoCodeUsed({ ...discounted, discounts: [] })).toBe("NLNVIP98");
    expect(h.promoRetrieve).toHaveBeenCalledWith("promo_2");
  });

  it("labels a discount with no code, or a failed lookup, and never throws", async () => {
    expect(await promoCodeUsed(discounted)).toBe(UNKNOWN_DISCOUNT);
    h.sessionRetrieve = vi.fn(async () => {
      throw new Error("stripe down");
    });
    expect(await promoCodeUsed(discounted)).toBe(UNKNOWN_DISCOUNT);
  });
});
