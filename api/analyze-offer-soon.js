import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getRedis, newSubmissionId, saveSubmission } from "./_lib/store.js";
import { extractTextFromUpload } from "./_lib/extract.js";
import {
  runSearchAnalysis,
  SOURCES_SCHEMA,
  RANGE_POINTS,
  STRATEGY_SCHEMA,
  RISK_TO_STRATEGY,
  normalizeRange,
} from "./_lib/analysis.js";

// Expecting-an-offer-soon analysis. No offer exists yet, but one is coming
// from a named company, so this returns a researched picture of what a strong
// offer looks like plus a read on how to handle the offer call.
//
// Separate from /api/analyze-apply on purpose: that endpoint coaches the
// screening call (a recruiter asking what you want), this one coaches the
// offer call (a recruiter telling you a number). Different moment, different
// prompt, different output fields.
//
// Deliberately does NOT use api/_lib/comparables.js. Like the other pre-offer
// flows, these are targets rather than real offers, so they neither consume
// nor contribute internal comparables.

function loadSystemPrompt() {
  try {
    const filePath = path.join(process.cwd(), "offer-soon-analyze-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (content) return content;
  } catch {
    // fall through to placeholder
  }
  return `You are a salary negotiation coach for Next Level Negotiation. The candidate expects a job offer soon from a specific company. Research current market compensation for their role, company, and location, then return what a strong offer looks like, how to read the number when they hear it, the biggest way they could give away leverage on the offer call, an honest read of their leverage, and three approaches. They must never accept or counter on the call itself.`;
}

const OFFER_SOON_TOOL = {
  name: "submit_offer_soon_analysis",
  description:
    "Submit the structured expecting-an-offer-soon analysis: a researched range and offer-call coaching.",
  input_schema: {
    type: "object",
    properties: {
      // Omitted entirely when no usable market data was found. The handler
      // normalizes a missing value to null, so the client always sees the
      // field. Kept out of `required` rather than typed as a union, which
      // some schema validators reject.
      market_range: {
        type: "object",
        properties: {
          base: RANGE_POINTS,
          total_comp: {
            ...RANGE_POINTS,
            description:
              "Total compensation range. Omit entirely unless searches returned total-comp data; never derive it from base with a multiplier.",
          },
        },
        required: ["base"],
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      range_rationale: {
        type: "string",
        description:
          "1-2 sentences citing the underlying numbers and how they were adjusted for seniority and location.",
      },
      offer_benchmark_note: {
        type: "string",
        description:
          "How to read the number the moment they hear it, using the range thresholds.",
      },
      biggest_risk: {
        type: "string",
        description:
          "The single most likely way THIS candidate gives away leverage on the offer call.",
      },
      leverage_read: {
        type: "string",
        description:
          "An honest read of their leverage, based only on opportunities they actually reported.",
      },
      call_status_note: {
        type: "string",
        description:
          "Personalized to where compensation stands, including a recovery note if they already shared a number.",
      },
      three_strategies: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: STRATEGY_SCHEMA,
      },
      recommended_strategy: {
        type: "string",
        enum: ["cautious", "balanced", "aggressive"],
      },
      sources: SOURCES_SCHEMA,
    },
    required: [
      "confidence",
      "range_rationale",
      "offer_benchmark_note",
      "biggest_risk",
      "leverage_read",
      "call_status_note",
      "three_strategies",
      "recommended_strategy",
      "sources",
    ],
  },
};

const COMP_STATUS_LABELS = {
  not_discussed: "We haven't talked numbers yet",
  recruiter_shared_range: "The recruiter shared a range",
  i_shared_number: "I already shared a number or range",
  both_shared: "We've both shared numbers",
};

const OTHER_PROCESS_LABELS = {
  none: "No other active processes — this is their only one",
  interviewing_elsewhere: "Interviewing elsewhere, no offer yet",
  expecting_offer: "Expecting another offer in the next 1-2 weeks",
  have_offer: "Already has another offer in hand",
};

const CALL_TIMING_LABELS = {
  scheduled: "The offer call is scheduled",
  any_day: "Expecting the call any day now",
  not_sure: "Not sure when the call will come",
};

function buildUserMessage(form) {
  const recruiterRange =
    form.recruiterRangeLow || form.recruiterRangeHigh
      ? `Recruiter's stated range: $${form.recruiterRangeLow || "?"} to $${form.recruiterRangeHigh || "?"} — compare this to the market honestly; it is their opening position, not the market`
      : null;

  const priorities =
    Array.isArray(form.priorities) && form.priorities.length
      ? `What matters to them beyond base salary: ${form.priorities.join(", ")}`
      : null;

  const lines = [
    "Job-search stage: Expecting an offer soon — they are at or near the end of the process with this company, and the offer call is the next compensation moment.",
    `Role: ${form.targetRole}`,
    `Company: ${form.targetCompany}`,
    `Location: ${form.location}`,
    `Years of experience: ${form.yearsExperience}`,
    `Risk tolerance: ${form.riskTolerance} — set recommended_strategy from this`,
    `Where compensation stands: ${COMP_STATUS_LABELS[form.compStatus] || form.compStatus}`,
    recruiterRange,
    form.sharedNumber
      ? `Number or range they already shared: ${form.sharedNumber} — treat it as an anchor already on the table and write the recovery note around it; do not let it pull the range down`
      : null,
    `Other opportunities: ${OTHER_PROCESS_LABELS[form.otherProcesses] || form.otherProcesses}`,
    form.otherCompExpected
      ? `Total comp they expect from the other opportunity: $${form.otherCompExpected}`
      : null,
    form.callTiming ? CALL_TIMING_LABELS[form.callTiming] : null,
    priorities,
    // Context for sanity-checking only. The prompt forbids echoing it, and
    // the script generator is told the same. This is TOTAL annual comp (base
    // plus bonus, commission, and annualized equity), so it is comparable to
    // the total_comp range, not to base.
    form.currentTotalComp
      ? `Current TOTAL annual compensation, base plus bonus/commission/equity (CONTEXT ONLY — never state this figure in your output, and never let it drag the range below what the market supports): $${form.currentTotalComp}`
      : "Current total annual compensation: not provided",
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  return `Research the market for this candidate and return the expecting-an-offer-soon analysis.\n\n${lines.join("\n")}`;
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
  if (
    !form ||
    !form.targetRole ||
    !form.targetCompany ||
    !form.location ||
    !form.yearsExperience ||
    !form.riskTolerance ||
    !form.compStatus ||
    !form.otherProcesses
  ) {
    return res.status(400).json({ error: "Missing required details." });
  }

  try {
    const client = new Anthropic({ apiKey });
    const redis = getRedis();

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
      userMessage += `\n\nCANDIDATE RESUME (optional context provided by the candidate — use it to place them within the seniority band, not to re-evaluate the candidate):\n${resumeText}`;
    }
    if (jobDescriptionText) {
      userMessage += `\n\nJOB DESCRIPTION (optional context provided by the candidate):\n${jobDescriptionText}`;
    }

    const analysis = await runSearchAnalysis({
      client,
      system: loadSystemPrompt(),
      userMessage,
      submitTool: OFFER_SOON_TOOL,
    });

    normalizeRange(analysis);
    // Set server-side from the form rather than trusting the model, the same
    // way every other flow derives its recommended strategy.
    analysis.recommended_strategy =
      RISK_TO_STRATEGY[form.riskTolerance] || "balanced";

    // Persist; failures are logged but never block the user.
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
          flow: "offer_soon",
          email: (leadEmail || "").trim().toLowerCase(),
          timestamp: new Date().toISOString(),
          form: formFields,
          analysis,
          comparablesSummary: null,
          resumeText,
          jobDescriptionText,
          script: null,
          scriptGeneratedAt: null,
        });
        analysis.submissionId = id;
      } catch (err) {
        console.error("Failed to store offer-soon submission:", err);
      }
    }

    return res.status(200).json(analysis);
  } catch (err) {
    console.error("Offer-soon analysis failed:", err);
    return res.status(502).json({
      error: "We couldn't build your range right now. Please try again.",
    });
  }
}
