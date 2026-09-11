import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getRedis, getSubmission, updateSubmission } from "./_lib/store.js";
import { verifyPayment } from "./_lib/payment.js";
import { STRATEGY_SESSION_URL } from "../src/lib/config.js";

// Generates the paid counter-offer script. The client sends the Stripe
// Checkout session id from the Payment Link redirect plus the offer data it
// kept in localStorage; we confirm the session is actually paid before
// calling the model.

function loadSystemPrompt() {
  try {
    const filePath = path.join(process.cwd(), "script-generator-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8").trim();
    // The prompt's sign-off links out to the paid strategy session. That URL
    // stays in src/lib/config.js rather than being duplicated in the prompt,
    // so changing the booking link is a one-line edit. It stays an absolute
    // external URL (not /session) because the script gets downloaded as a
    // standalone PDF, where an in-app relative link would be dead.
    if (content) {
      return content.replaceAll("{{strategy_session_url}}", STRATEGY_SESSION_URL);
    }
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
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  // The user's stated risk tolerance selects the strategy; older result
  // links predate the question and fall back to Balanced.
  const strategyName =
    { Cautious: "Conservative", Balanced: "Balanced", Aggressive: "Aggressive" }[
      form.riskTolerance
    ] || "Balanced";

  return [
    "Write the counter-offer script for this candidate.",
    "",
    "OFFER DETAILS:",
    offerLines.join("\n"),
    "",
    `SELECTED STRATEGY: ${strategyName} (chosen based on the candidate's stated risk tolerance${form.riskTolerance ? `: "${form.riskTolerance}"` : ""})`,
    "",
    "NEGOTIATION ANALYSIS THEY RECEIVED:",
    JSON.stringify(analysis, null, 2),
  ].join("\n");
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

    // Optional resume/JD context was extracted and stored at analysis time
    // (files can't travel through the URL-encoded results). Missing record
    // or storage trouble simply means the script goes without it.
    let userMessage = buildUserMessage(form, analysis);
    if (analysis.submissionId) {
      try {
        const redis = getRedis();
        const record = redis
          ? await getSubmission(redis, analysis.submissionId)
          : null;
        if (record?.resumeText) {
          userMessage += `\n\nCANDIDATE RESUME (optional context — use it to make the value headline and counter specific to their background):\n${record.resumeText}`;
        }
        if (record?.jobDescriptionText) {
          userMessage += `\n\nJOB DESCRIPTION (optional context):\n${record.jobDescriptionText}`;
        }
      } catch (err) {
        console.error("Failed to load stored context for script:", err);
      }
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: loadSystemPrompt(),
      messages: [{ role: "user", content: userMessage }],
    });

    const script = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!script) {
      throw new Error("Empty script response from model.");
    }

    // Attach the script to the stored submission (id travels inside the
    // analysis object from /api/analyze). Never blocks the user on failure.
    if (analysis.submissionId) {
      try {
        const redis = getRedis();
        if (redis) {
          await updateSubmission(redis, analysis.submissionId, {
            script,
            scriptGeneratedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.error("Failed to attach script to submission:", err);
      }
    }

    return res.status(200).json({ script });
  } catch (err) {
    console.error("Script generation failed:", err);
    return res.status(502).json({
      error: "We couldn't generate your script right now. Please try again.",
    });
  }
}
