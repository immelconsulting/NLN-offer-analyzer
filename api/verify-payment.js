import { verifyPayment } from "./_lib/payment.js";

// Confirms a Stripe checkout session was actually paid, so /booking can
// reveal the strategy-session calendar link. The calendar URL itself never
// leaves the server config unverified — otherwise anyone who guessed the
// /booking route could book a paid session for free.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: "Missing payment session." });
  }

  const payment = await verifyPayment(sessionId);
  if (!payment.paid) {
    return res.status(payment.status).json({ error: payment.error });
  }

  return res.status(200).json({ paid: true });
}
