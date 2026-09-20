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

// The offer flow writes a counter-offer script. Both pre-offer stages
// (Applying and Interviewing) face the same moment and share one screening
// call prompt, so a voice change is a single edit rather than two.
const PROMPT_FILES = {
  offer: "script-generator-prompt.md",
  apply: "apply-script-generator-prompt.md",
  interview: "apply-script-generator-prompt.md",
};

const PRE_OFFER_FLOWS = ["apply", "interview"];

function loadSystemPrompt(flow = "offer") {
  try {
    const filePath = path.join(
      process.cwd(),
      PROMPT_FILES[flow] || PROMPT_FILES.offer
    );
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

const STAGE_LABELS = {
  no_call: "No recruiter call yet",
  call_scheduled: "A call is scheduled or coming up",
  dodged: "A recruiter asked and I dodged it",
  gave_number: "I already gave a number",
};

const parseMoney = (value) => {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const fmtMoney = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

// Applying flow. The walk-away floor is the low end of the researched range,
// raised to what the candidate already earns so nobody is scripted to accept
// a pay cut. The current figure itself is never passed to the model as such.
//
// The form asks for TOTAL annual compensation, so it may only be compared
// against the total_comp range. Comparing it to base would silently inflate
// the base floor, since total comp normally sits well above base.
function applyFloors(form, analysis) {
  const range = analysis.market_range;
  const currentTotal = parseMoney(form.currentTotalComp);
  const baseFloor = range?.base?.low ?? null;
  let totalFloor = range?.total_comp?.low ?? null;
  let note = "";

  if (currentTotal !== null && (totalFloor === null || currentTotal > totalFloor)) {
    totalFloor = currentTotal;
    note =
      " (set by what they already earn in total, which is above the researched low end; state it only as their floor, never as their current pay)";
  }
  // Total compensation is always at least base, so a total floor below the
  // base floor is incoherent — it would appear when someone's current total
  // comp sits under the researched base low, which is itself a sign they're
  // underpaid. The base floor already protects them, so drop the total one.
  if (totalFloor !== null && baseFloor !== null && totalFloor < baseFloor) {
    totalFloor = null;
    note = "";
  }
  return { baseFloor, totalFloor, note };
}

const STAGE_SITUATIONS = {
  apply: "Applying: actively applying to roles, so the recruiter screening call is the next compensation moment ahead of them.",
  interview:
    "Interviewing: already in the process, so the salary question is either imminent or has already come up at least once.",
};

function buildApplyUserMessage(form, analysis, flow = "apply") {
  const { baseFloor, totalFloor, note } = applyFloors(form, analysis);

  const lines = [
    `Job-search stage: ${STAGE_SITUATIONS[flow] || STAGE_SITUATIONS.apply} Reference this naturally in the intro.`,
    `Target role: ${form.targetRole}`,
    form.targetCompany ? `Target company: ${form.targetCompany}` : null,
    `Location: ${form.location}`,
    `Years of experience: ${form.yearsExperience}`,
    `Where they are with the salary question: ${STAGE_LABELS[form.salaryStage] || form.salaryStage}`,
    form.salaryStage === "gave_number" && form.sharedNumber
      ? `Number they already shared: $${form.sharedNumber} — include the recovery section`
      : null,
    baseFloor !== null
      ? `WALK-AWAY FLOOR (base): ${fmtMoney(baseFloor)}`
      : "WALK-AWAY FLOOR (base): unavailable — no researched range, use fill-in blanks",
    totalFloor !== null
      ? `WALK-AWAY FLOOR (total compensation): ${fmtMoney(totalFloor)}${note}`
      : null,
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  const strategyName =
    { Cautious: "cautious", Balanced: "balanced", Aggressive: "aggressive" }[
      form.riskTolerance
    ] || "balanced";

  return [
    "Write the recruiter screening call script for this candidate.",
    "",
    "CANDIDATE DETAILS:",
    lines.join("\n"),
    "",
    `RECOMMENDED STRATEGY: ${strategyName} (from their stated risk tolerance${form.riskTolerance ? `: "${form.riskTolerance}"` : ""}) — use it to set the width of the wide-range answer`,
    "",
    "PRE-OFFER ANALYSIS THEY RECEIVED:",
    JSON.stringify(analysis, null, 2),
  ].join("\n");
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

  const { sessionId, form, analysis, flow: rawFlow } = req.body || {};
  const flow = PRE_OFFER_FLOWS.includes(rawFlow) ? rawFlow : "offer";
  const isPreOffer = flow !== "offer";
  if (!sessionId) {
    return res.status(400).json({ error: "Missing payment session." });
  }
  if (!form || !analysis) {
    return res.status(400).json({ error: "Missing offer details." });
  }
  if (isPreOffer) {
    if (!form.targetRole || !form.location) {
      return res.status(400).json({ error: "Missing candidate details." });
    }
  } else if (!form.role || !form.location || !form.offerBaseSalary) {
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
    let userMessage = isPreOffer
      ? buildApplyUserMessage(form, analysis, flow)
      : buildUserMessage(form, analysis);
    if (analysis.submissionId) {
      try {
        const redis = getRedis();
        const record = redis
          ? await getSubmission(redis, analysis.submissionId)
          : null;
        if (record?.resumeText) {
          userMessage +=
            isPreOffer
              ? `\n\nCANDIDATE RESUME (optional context — use it to make the closing questions specific to their background):\n${record.resumeText}`
              : `\n\nCANDIDATE RESUME (optional context — use it to make the value headline and counter specific to their background):\n${record.resumeText}`;
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
      system: loadSystemPrompt(flow),
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
