import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

// Loads the system prompt from system-prompt.md at the project root so it can
// be edited without touching this file. Falls back to a placeholder if the
// file is empty so the endpoint still works before the real prompt is added.
function loadSystemPrompt() {
  try {
    const filePath = path.join(process.cwd(), "system-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (content) return content;
  } catch {
    // fall through to placeholder
  }
  return `You are a salary negotiation coach for Next Level Negotiation. Analyze the job offer details provided and return a structured negotiation analysis: an offer score (0-100) with a one-line interpretation, at least 3 specific negotiation opportunities with brief explanations and estimated dollar impact where possible, three negotiation strategies (Conservative, Balanced, Aggressive) each with an expected outcome, pros, cons, and risk level, and one clear recommended next step.`;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    offerScore: {
      type: "integer",
      description: "Overall offer strength score from 0 to 100.",
    },
    scoreInterpretation: {
      type: "string",
      description: "One-line plain-English interpretation of the score.",
    },
    opportunities: {
      type: "array",
      minItems: 3,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          estimatedImpact: {
            type: "string",
            description:
              "Estimated dollar impact if applicable, e.g. '+$8,000-$12,000'. Empty string if not applicable.",
          },
        },
        required: ["title", "explanation", "estimatedImpact"],
        additionalProperties: false,
      },
    },
    strategies: {
      type: "object",
      properties: {
        conservative: { $ref: "#/$defs/strategy" },
        balanced: { $ref: "#/$defs/strategy" },
        aggressive: { $ref: "#/$defs/strategy" },
      },
      required: ["conservative", "balanced", "aggressive"],
      additionalProperties: false,
    },
    recommendedNextStep: { type: "string" },
  },
  required: [
    "offerScore",
    "scoreInterpretation",
    "opportunities",
    "strategies",
    "recommendedNextStep",
  ],
  additionalProperties: false,
  $defs: {
    strategy: {
      type: "object",
      properties: {
        name: { type: "string" },
        expectedOutcome: { type: "string" },
        pros: { type: "array", items: { type: "string" } },
        cons: { type: "array", items: { type: "string" } },
        riskLevel: { type: "string", enum: ["Low", "Medium", "High"] },
      },
      required: ["name", "expectedOutcome", "pros", "cons", "riskLevel"],
      additionalProperties: false,
    },
  },
};

function buildUserMessage(form) {
  const lines = [
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

  return `Analyze the following job offer and return the negotiation analysis.\n\n${lines.join("\n")}`;
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

  const form = req.body;
  if (!form || !form.role || !form.location || !form.offerBaseSalary) {
    return res.status(400).json({ error: "Missing required offer details." });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: loadSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(form) }],
      output_config: {
        format: { type: "json_schema", schema: RESPONSE_SCHEMA },
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock) {
      throw new Error("No text response from model.");
    }
    const analysis = JSON.parse(textBlock.text);

    return res.status(200).json(analysis);
  } catch (err) {
    console.error("Offer analysis failed:", err);
    return res.status(502).json({
      error: "We couldn't analyze your offer right now. Please try again.",
    });
  }
}
