import Stripe from "stripe";
import { getRedis } from "./_lib/store.js";
import { strategySessionTier } from "./_lib/payment.js";
import { CONTACT_EMAIL } from "../src/lib/config.js";

// Emails JobJenny the moment someone buys a strategy session, so Alisa can
// send a welcome and client-portal invite while the negotiation is still
// fresh. Stripe can't do this itself: receipts only go to the buyer, and its
// payment notifications only go to people with a login on NLN's account.
//
// Stripe calls this for checkout.session.completed (and
// async_payment_succeeded, for payment methods that clear later). The $47
// script and anything else that isn't a session tier is ignored.
//
// Authenticity: rather than trusting the posted body, we re-fetch the event
// from Stripe by id with our own secret key — a forged post can name an event
// id, but can't make Stripe return one that doesn't exist on our account.
// That also sidesteps raw-body signature checks, which Vercel's body parsing
// makes fiddly.
//
// Env: RESEND_API_KEY (required to send), SESSION_ALERT_TO (default
// info@jobjenny.com, comma-separate for more), SESSION_ALERT_FROM (an address
// on a domain verified in Resend).

const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];
const ADMIN_URL = "https://nln-offer-analyzer.vercel.app/admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const eventId = req.body?.id;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!eventId || !stripeKey) {
    return res.status(400).json({ error: "Missing event or Stripe config." });
  }

  const stripe = new Stripe(stripeKey);
  let event;
  try {
    event = await stripe.events.retrieve(eventId);
  } catch (err) {
    console.error("Webhook: event lookup failed:", eventId, err.message);
    return res.status(400).json({ error: "Unknown event." });
  }
  if (!HANDLED_EVENTS.includes(event.type)) {
    return res.status(200).json({ ignored: event.type });
  }

  const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
    expand: ["line_items"],
  });
  // A bank payment fires "completed" while still unpaid; the alert waits for
  // async_payment_succeeded instead.
  if (!["paid", "no_payment_required"].includes(session.payment_status)) {
    return res.status(200).json({ ignored: "not paid yet" });
  }
  const tier = strategySessionTier(session);
  if (!tier) {
    return res.status(200).json({ ignored: "not a strategy session" });
  }

  // Stripe retries and may deliver both events, so alert once per checkout.
  const redis = getRedis();
  const dedupeKey = `nln:session-alert:${session.id}`;
  if (redis && !(await redis.set(dedupeKey, event.id, { nx: true, ex: 60 * 60 * 24 * 30 }))) {
    return res.status(200).json({ duplicate: true });
  }

  try {
    await sendAlert(session, tier);
  } catch (err) {
    console.error("Webhook: alert email failed:", session.id, err.message);
    // Release the lock so Stripe's retry gets another go.
    if (redis) await redis.del(dedupeKey);
    return res.status(500).json({ error: "Alert email failed." });
  }
  return res.status(200).json({ alerted: true });
}

export async function sendAlert(session, tier) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const name = session.customer_details?.name || "(no name given)";
  const email = session.customer_details?.email || "(no email given)";
  const phone = session.customer_details?.phone;
  const paid = `$${(session.amount_total / 100).toFixed(2)}`;

  const lines = [
    `Someone just bought a Negotiation Strategy Session (${tier.label}).`,
    "",
    `Name:  ${name}`,
    `Email: ${email}`,
    ...(phone ? [`Phone: ${phone}`] : []),
    `Tier:  ${tier.label}`,
    `Paid:  ${paid}`,
    "",
    "They've been sent to the Thryv calendar for this tier to pick a time.",
    "",
    `NLN admin: ${ADMIN_URL}`,
  ];

  const to = (process.env.SESSION_ALERT_TO || "info@jobjenny.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.SESSION_ALERT_FROM || "NLN Alerts <alerts@nextlevelnegotiation.com>",
      to,
      cc: [CONTACT_EMAIL],
      reply_to: session.customer_details?.email || undefined,
      subject: `New Strategy Session (${tier.label}): ${name}`,
      text: lines.join("\n"),
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
}
