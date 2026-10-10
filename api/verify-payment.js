import { verifyPayment } from "./_lib/payment.js";
import { SESSION_TIERS } from "../src/lib/config.js";

// Confirms a Stripe checkout session was actually paid for a strategy
// session, and returns the Thryv calendar link for the tier that was bought.
// The calendar URLs only ever leave the server through here — otherwise
// anyone who guessed the /booking route could book a paid session for free,
// or someone who paid for 30 minutes could pick the hour.
//
// The tier comes from the purchased Price's lookup key (see SESSION_TIERS in
// config.js). A paid session for anything else — e.g. the $47 script — is
// rejected rather than shown a calendar.

const TIER_KEYS = { "30": "nln_strategy_session_30min", "60": "nln_strategy_session_60min" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, testTier } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: "Missing payment session." });
  }

  const payment = await verifyPayment(sessionId, { expand: ["line_items"] });
  if (!payment.paid) {
    return res.status(payment.status).json({ error: payment.error });
  }

  // The test bypass has no Stripe session to read, so the testing links on
  // /session pass the tier explicitly.
  const lookupKey = payment.session
    ? payment.session.line_items?.data?.[0]?.price?.lookup_key
    : TIER_KEYS[testTier] || TIER_KEYS["30"];

  const tier = SESSION_TIERS[lookupKey];
  if (!tier) {
    console.error("Paid session has no strategy-session tier:", sessionId, lookupKey);
    return res
      .status(422)
      .json({ error: "We confirmed your payment but couldn't match it to a session length." });
  }

  return res.status(200).json({ paid: true, tier: tier.label, bookingUrl: tier.bookingUrl });
}
