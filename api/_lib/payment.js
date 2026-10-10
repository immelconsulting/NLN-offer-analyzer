import Stripe from "stripe";
import { SESSION_TIERS } from "../../src/lib/config.js";

// Shared Stripe checkout verification. Used by anything that gates a paid
// deliverable behind a completed payment — the counter-offer script
// (api/generate-script.js) and the strategy-session booking link
// (api/verify-payment.js). Files under api/_lib are not deployed as
// serverless functions (underscore prefix), just imported.

// Pass `expand` (e.g. ["line_items"]) when the caller needs to know what was
// bought; the retrieved session comes back as `session` on success.
export async function verifyPayment(sessionId, { expand } = {}) {
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
    const session = await stripe.checkout.sessions.retrieve(
      sessionId,
      expand ? { expand } : undefined
    );
    // "no_payment_required" covers $0 checkouts (e.g. a 100%-off promo code).
    if (!["paid", "no_payment_required"].includes(session.payment_status)) {
      return { paid: false, error: "This payment hasn't been completed.", status: 402 };
    }
    return { paid: true, session };
  } catch (err) {
    console.error("Stripe session lookup failed:", err);
    return { paid: false, error: "We couldn't verify your payment.", status: 402 };
  }
}

// Which strategy-session tier a Checkout Session bought, or null for anything
// else (e.g. the $47 script). Needs the session retrieved with
// expand: ["line_items"]. Prices made by scripts/create-session-payment-links.js
// carry a lookup key; the live ones were made in the dashboard and have none,
// so the Price's list amount (unaffected by promo codes) is the fallback.
const PRICE_AMOUNT_KEYS = {
  19900: "nln_strategy_session_30min",
  32900: "nln_strategy_session_60min",
};

export function strategySessionTier(session) {
  const price = session?.line_items?.data?.[0]?.price;
  return SESSION_TIERS[price?.lookup_key || PRICE_AMOUNT_KEYS[price?.unit_amount]] || null;
}
