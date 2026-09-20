import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getRedis, newSubmissionId, saveSubmission } from "./_lib/store.js";
import { extractTextFromUpload } from "./_lib/extract.js";
import { runSearchAnalysis, SOURCES_SCHEMA } from "./_lib/analysis.js";

// Applying-stage analysis: no offer exists yet, so instead of scoring an
// offer this returns a researched target range and coaching for the recruiter
// screening call.
//
// Deliberately does NOT use api/_lib/comparables.js. Apply submissions are
// aspirational targets rather than real offers, so they neither consume nor
// contribute internal comparables.

function loadSystemPrompt() {
  try {
    const filePath = path.join(process.cwd(), "apply-analyze-prompt.md");
    const content = fs.readFileSync(filePath, "utf-8").trim();
    if (content) return content;
  } catch {
    // fall through to placeholder
  }
  return `You are a salary negotiation coach for Next Level Negotiation. The candidate is still applying and has no offer. Research current market compensation for their role and location, then return a target salary range adjusted for their seniority and market, the biggest way they could undercut themselves on a recruiter screening call, a note tailored to where they are with the salary question, and three approaches to answering it.`;
}

// Low / target / stretch, in whole dollars.
const RANGE_POINTS = {
  type: "object",
  properties: {
    low: { type: "integer", description: "Bottom of the defensible range; the walk-away floor." },
    target: { type: "integer", description: "Realistic, well-supported number to aim at." },
    stretch: { type: "integer", description: "Top of the band for a strong candidate." },
  },
  required: ["low", "target", "stretch"],
};

const STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string", enum: ["cautious", "balanced", "aggressive"] },
    style: { type: "string", description: "Short label, e.g. 'Deflect and redirect'." },
    when_to_use: { type: "string" },
    summary: { type: "string", description: "What they actually do, 1-2 sentences." },
  },
  required: ["id", "style", "when_to_use", "summary"],
};

const APPLY_TOOL = {
  name: "submit_apply_analysis",
  description:
    "Submit the structured applying-stage analysis: a researched target range and recruiter-call coaching.",
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
      biggest_risk: {
        type: "string",
        description:
          "The single most likely way THIS candidate undercuts themselves on the call, using their stage answer.",
      },
      call_status_note: {
        type: "string",
        description:
          "Personalized to their salary-question stage, including a recovery note if they already gave a number.",
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
      "biggest_risk",
      "call_status_note",
      "three_strategies",
      "recommended_strategy",
      "sources",
    ],
  },
};

// Matches the offer flow's mapping from the risk-tolerance answer.
const RISK_TO_STRATEGY = {
  Cautious: "cautious",
  Balanced: "balanced",
  Aggressive: "aggressive",
};

const STAGE_LABELS = {
  no_call: "No recruiter call yet",
  call_scheduled: "A call is scheduled or coming up",
  dodged: "A recruiter asked and I dodged it",
  gave_number: "I already gave a number",
};

function buildUserMessage(form) {
  const lines = [
    `Target role: ${form.targetRole}`,
    form.targetCompany ? `Target company: ${form.targetCompany}` : null,
    `Location: ${form.location}`,
    `Years of experience: ${form.yearsExperience}`,
    `Risk tolerance: ${form.riskTolerance} — set recommended_strategy from this`,
    `Where they are with the salary question: ${STAGE_LABELS[form.salaryStage] || form.salaryStage}`,
    form.salaryStage === "gave_number" && form.sharedNumber
      ? `Number they already shared: $${form.sharedNumber} — treat this as an anchor already on the table and write the recovery note around it`
      : null,
    // Context for sanity-checking only. The prompt forbids echoing it, and
    // the script generator is told the same.
    form.currentSalary
      ? `Current base salary (CONTEXT ONLY — never state this figure in your output, and never let it drag the range below what the market supports): $${form.currentSalary}`
      : "Current base salary: not provided",
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  return `Research the market for this candidate and return the applying-stage analysis.\n\n${lines.join("\n")}`;
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
    !form.location ||
    !form.yearsExperience ||
    !form.riskTolerance ||
    !form.salaryStage
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
      submitTool: APPLY_TOOL,
    });

    if (!Array.isArray(analysis.sources)) {
      analysis.sources = [];
    }
    // The tool omits market_range when there's no usable data; normalize so
    // the client only ever has to check for null.
    if (!analysis.market_range?.base) {
      analysis.market_range = null;
    } else if (!analysis.market_range.total_comp) {
      analysis.market_range.total_comp = null;
    }
    // Set server-side from the form rather than trusting the model, the same
    // way the offer flow derives its recommended strategy from risk tolerance.
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
          flow: "apply",
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
        console.error("Failed to store apply submission:", err);
      }
    }

    return res.status(200).json(analysis);
  } catch (err) {
    console.error("Apply analysis failed:", err);
    return res.status(502).json({
      error: "We couldn't build your range right now. Please try again.",
    });
  }
}
