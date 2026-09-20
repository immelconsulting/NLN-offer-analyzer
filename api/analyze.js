import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import {
  getRedis,
  newSubmissionId,
  saveSubmission,
  listRecentSubmissions,
} from "./_lib/store.js";
import { buildComparablesSummary } from "./_lib/comparables.js";
import { extractTextFromUpload } from "./_lib/extract.js";
import { runSearchAnalysis, SOURCES_SCHEMA } from "./_lib/analysis.js";

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

const STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    expectedOutcome: { type: "string" },
    pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } },
    riskLevel: { type: "string", enum: ["Low", "Medium", "High"] },
  },
  required: ["name", "expectedOutcome", "pros", "cons", "riskLevel"],
};

const ANALYSIS_TOOL = {
  name: "submit_offer_analysis",
  description: "Submit the structured offer analysis to the user.",
  input_schema: {
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
              description: "Estimated dollar impact, e.g. '+$8,000-$12,000'. Empty string if not applicable.",
            },
          },
          required: ["title", "explanation", "estimatedImpact"],
        },
      },
      strategies: {
        type: "object",
        properties: {
          conservative: STRATEGY_SCHEMA,
          balanced: STRATEGY_SCHEMA,
          aggressive: STRATEGY_SCHEMA,
        },
        required: ["conservative", "balanced", "aggressive"],
      },
      recommendedNextStep: { type: "string" },
      // Empty is allowed for the genuinely-no-data case; the system prompt
      // requires at least one entry whenever searches found anything usable.
      sources: SOURCES_SCHEMA,
    },
    required: [
      "offerScore",
      "scoreInterpretation",
      "opportunities",
      "strategies",
      "recommendedNextStep",
      "sources",
    ],
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
    form.riskTolerance
      ? `Risk tolerance: ${form.riskTolerance} — tailor the recommended next step to this appetite`
      : null,
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  return `Analyze the following job offer and return the negotiation analysis.\n\n${lines.join("\n")}`;
}

// Anonymized aggregate of similar prior submissions, or null. Any storage
// problem degrades to "no internal data" rather than failing the request.
async function getInternalMarketData(redis, form) {
  if (!redis) return null;
  try {
    const recent = await listRecentSubmissions(redis, 200);
    return buildComparablesSummary(recent, {
      role: form.role,
      location: form.location,
      excludeEmail: (form.leadEmail || "").trim().toLowerCase(),
    });
  } catch (err) {
    console.error("Comparables lookup failed:", err);
    return null;
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

  const form = req.body;
  if (!form || !form.role || !form.location || !form.offerBaseSalary) {
    return res.status(400).json({ error: "Missing required offer details." });
  }

  try {
    const client = new Anthropic({ apiKey });

    const redis = getRedis();
    const comparables = await getInternalMarketData(redis, form);

    // Optional context uploads: extract text server-side; failures simply
    // mean the analysis proceeds without that context.
    const resumeText = await extractTextFromUpload(form.resumeFile);
    const jobDescriptionText =
      (await extractTextFromUpload(form.jobDescriptionFile)) ||
      (typeof form.jobDescriptionText === "string" &&
      form.jobDescriptionText.trim()
        ? form.jobDescriptionText.trim().slice(0, 8000)
        : null);

    let userMessage = buildUserMessage(form);
    if (resumeText) {
      userMessage += `\n\nCANDIDATE RESUME (optional context provided by the candidate — use it to sharpen the value framing and opportunities, not to re-evaluate the candidate):\n${resumeText}`;
    }
    if (jobDescriptionText) {
      userMessage += `\n\nJOB DESCRIPTION (optional context provided by the candidate):\n${jobDescriptionText}`;
    }
    if (comparables) {
      userMessage += `\n\nINTERNAL MARKET DATA (anonymized aggregate from NLN's own past submissions — treat as one signal alongside your general market knowledge, not as a replacement for it):\n${comparables}`;
    }

    // Searches first, then submits — see api/_lib/analysis.js for why the
    // tool choice has to stay "auto" and how the loop resumes.
    const analysis = await runSearchAnalysis({
      client,
      system: loadSystemPrompt(),
      userMessage,
      submitTool: ANALYSIS_TOOL,
    });

    // Older result links predate this field; keep it an array either way.
    if (!Array.isArray(analysis.sources)) {
      analysis.sources = [];
    }
    // Set server-side (not by the model) so it's reliable in the admin view.
    analysis.internalDataUsed = Boolean(comparables);

    // Persist the submission; failures are logged but never block the user.
    if (redis) {
      try {
        const id = newSubmissionId();
        // Files stay out of storage — only the extracted text is kept.
        const {
          leadEmail,
          resumeFile,
          jobDescriptionFile,
          jobDescriptionText: _jdRaw,
          ...formFields
        } = form;
        await saveSubmission(redis, {
          id,
          email: (leadEmail || "").trim().toLowerCase(),
          timestamp: new Date().toISOString(),
          form: formFields,
          analysis,
          comparablesSummary: comparables,
          resumeText,
          jobDescriptionText,
          script: null,
          scriptGeneratedAt: null,
        });
        analysis.submissionId = id;
      } catch (err) {
        console.error("Failed to store submission:", err);
      }
    }

    return res.status(200).json(analysis);
  } catch (err) {
    console.error("Offer analysis failed:", err);
    return res.status(502).json({
      error: "We couldn't analyze your offer right now. Please try again.",
    });
  }
}
