import { describe, it, expect } from "vitest";
import { strategySessionTier } from "../api/_lib/payment.js";
import { THRIVE_30MIN_BOOKING_URL, THRIVE_60MIN_BOOKING_URL } from "../src/lib/config.js";

const session = (price) => ({ line_items: { data: [{ price }] } });

describe("strategySessionTier: which session a payment bought", () => {
  it("reads the live dashboard-made Prices by amount", () => {
    expect(strategySessionTier(session({ unit_amount: 19900 }))?.bookingUrl).toBe(THRIVE_30MIN_BOOKING_URL);
    expect(strategySessionTier(session({ unit_amount: 32900 }))?.bookingUrl).toBe(THRIVE_60MIN_BOOKING_URL);
  });

  it("prefers a lookup key when the Price has one", () => {
    const s = session({ unit_amount: 1, lookup_key: "nln_strategy_session_60min" });
    expect(strategySessionTier(s)?.label).toBe("60 minutes");
  });

  it("gives no calendar for the $47 script or anything unknown", () => {
    expect(strategySessionTier(session({ unit_amount: 4700 }))).toBeNull();
    expect(strategySessionTier(session(undefined))).toBeNull();
    expect(strategySessionTier(undefined)).toBeNull();
  });
});
