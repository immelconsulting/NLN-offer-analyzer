import Stripe from "stripe";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// Generates the paid counter-offer script. The client sends the Stripe
// Checkout session id from the Payment Link redirect plus the offer data it
// kept in localStorage; we confirm the session is actually paid before
// calling the model.

function loadSystemPrompt() {
  try {
    const filePath = path.join(process.cwd(), "script-generator-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (content) return content;
  } catch {
    // fall through to placeholder
  }
  return "You are a salary negotiation coach for Next Level Negotiation. Write a complete, word-for-word counter-offer script tailored to the candidate's offer details and negotiation analysis, covering the opening, the counter itself, objection handling, and the close.";
}

function buildUserMessage(form, analysis) {
  const offerLines = [
    `Role: ${form.role}`,
    form.company ? `Company: ${form.company}` : null,
    `Location: ${form.location}`,
    `Industry: ${form.industry}`,
    form.currentSalary ? `Current salary: $${form.currentSalary}` : "Current salary: not provided",
    `Offer base salary: $${form.offerBaseSalary}`,
    form.hasBonus ? `Bonus: yes — ${form.bonusAmount}` : "Bonus: no",
    form.hasSignOnBonus
      ? `Sign-on bonus: yes — ${form.signOnBonusAmount}`
      : "Sign-on bonus: no",
    form.hasEquity ? `Equity: yes — ${form.equityAmount}` : "Equity: no",
    `Top priority: ${form.topPriority}`,
    form.hasLeverage
      ? `Competing offer / leverage: yes${form.leverageDetails ? ` — ${form.leverageDetails}` : ""}`
      : "Competing offer / leverage: no",
    form.offerDeadline ? `Offer deadline: ${form.offerDeadline}` : null,
  ].filter(Boolean);

  return [
    "Write the counter-offer script for this candidate.",
    "",
    "OFFER DETAILS:",
    offerLines.join("\n"),
    "",
    "SELECTED STRATEGY: Balanced (the strategy recommended in their analysis)",
    "",
    "NEGOTIATION ANALYSIS THEY RECEIVED:",
    JSON.stringify(analysis, null, 2),
  ].join("\n");
}

async function verifyPayment(sessionId) {
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is misconfigured (missing API key)." });
  }

  const { sessionId, form, analysis } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: "Missing payment session." });
  }
  if (!form || !form.role || !form.location || !form.offerBaseSalary || !analysis) {
    return res.status(400).json({ error: "Missing offer details." });
  }

  const payment = await verifyPayment(sessionId);
  if (!payment.paid) {
    return res.status(payment.status).json({ error: payment.error });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: loadSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(form, analysis) }],
    });

    const script = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!script) {
      throw new Error("Empty script response from model.");
    }

    return res.status(200).json({ script });
  } catch (err) {
    console.error("Script generation failed:", err);
    return res.status(502).json({
      error: "We couldn't generate your script right now. Please try again.",
    });
  }
}
