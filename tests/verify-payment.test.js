import { describe, it, expect } from "vitest";
import handler from "../api/verify-payment.js";
import { THRIVE_30MIN_BOOKING_URL, THRIVE_60MIN_BOOKING_URL } from "../src/lib/config.js";

// Runs with no Stripe key and outside production, like a preview deploy, so
// only the test session can pass.
const call = (body, method = "POST") =>
  new Promise((resolve) =>
    handler(
      { method, body },
      { setHeader() {}, status(c) { this.c = c; return this; }, json(b) { resolve({ status: this.c, body: b }); } }
    )
  );

describe("/api/verify-payment (booking gate)", () => {
  it("sends each test tier to its own Thryv calendar", async () => {
    expect((await call({ sessionId: "test_skip_payment", testTier: "30" })).body.bookingUrl).toBe(THRIVE_30MIN_BOOKING_URL);
    expect((await call({ sessionId: "test_skip_payment", testTier: "60" })).body.bookingUrl).toBe(THRIVE_60MIN_BOOKING_URL);
  });

  it("reveals no calendar without a verifiable payment", async () => {
    const r = await call({ sessionId: "cs_live_fake" });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.body.bookingUrl).toBeUndefined();
  });

  it("rejects a missing session and non-POST requests", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({}, "GET")).status).toBe(405);
  });
});
