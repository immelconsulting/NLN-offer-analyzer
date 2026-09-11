import Stripe from "stripe";

// Shared Stripe checkout verification. Used by anything that gates a paid
// deliverable behind a completed payment — the counter-offer script
// (api/generate-script.js) and the strategy-session booking link
// (api/verify-payment.js). Files under api/_lib are not deployed as
// serverless functions (underscore prefix), just imported.

export async function verifyPayment(sessionId) {
  // Escape hatch for testing without a real payment. Always available off
  // production; in production only while ALLOW_TEST_BYPASS=true is set
  // (temporary free-test mode — see FREE_TEST_MODE in src/lib/config.js).
  if (
    sessionId === "test_skip_payment" &&
    (process.env.VERCEL_ENV !== "production" ||
      process.env.ALLOW_TEST_BYPASS === "true")
  ) {
    return { paid: true };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return { paid: false, error: "Payment verification is not configured.", status: 500 };
  }

  try {
    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // "no_payment_required" covers $0 checkouts (e.g. a 100%-off promo code).
    if (!["paid", "no_payment_required"].includes(session.payment_status)) {
      return { paid: false, error: "This payment hasn't been completed.", status: 402 };
    }
    return { paid: true };
  } catch (err) {
    console.error("Stripe session lookup failed:", err);
    return { paid: false, error: "We couldn't verify your payment.", status: 402 };
  }
}
