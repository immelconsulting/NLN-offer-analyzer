import { getSubmission } from "./store.js";
import { loadPrompt } from "./prompts.js";
import { STRATEGY_SESSION_URL } from "../../src/lib/config.js";

// Everything the script model is told: which prompt file, and the message
// built from the candidate's answers. Shared by the paid script and the free
// preview so the two can't drift apart.

// One prompt file per flow.
const PROMPT_FILES = {
  offer: "script-generator-prompt.md",
  // Applying and Interviewing face the same moment and share one screening
  // call prompt, so a voice change is a single edit rather than two.
  apply: "apply-script-generator-prompt.md",
  interview: "apply-script-generator-prompt.md",
  // Expecting-an-offer-soon coaches the offer call instead, so it has its own.
  offer_soon: "offer-soon-script-generator-prompt.md",
};

// Flows whose form uses targetRole/targetCompany rather than role/company.
export const PRE_OFFER_FLOWS = ["apply", "interview", "offer_soon"];
export const SCREENING_FLOWS = ["apply", "interview"];

export function loadSystemPrompt(flow = "offer") {
  // The prompt's sign-off links out to the paid strategy session. That URL
  // stays in src/lib/config.js rather than being duplicated in the prompt,
  // so changing the booking link is a one-line edit. It stays an absolute
  // external URL (not /session) because the script gets downloaded as a
  // standalone PDF, where an in-app relative link would be dead.
  return loadPrompt(PROMPT_FILES[flow] || PROMPT_FILES.offer).replaceAll(
    "{{strategy_session_url}}",
    STRATEGY_SESSION_URL
  );
}

const STAGE_LABELS = {
  no_call: "No recruiter call yet",
  call_scheduled: "A call is scheduled or coming up",
  dodged: "A recruiter asked and I dodged it",
  gave_number: "I already gave a number",
  told_number: "They told me the salary or range",
  not_asked: "They haven't asked, and I don't expect them to",
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
export function applyFloors(form, analysis) {
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
    form.salaryStage === "told_number"
      ? `The recruiter told them the number${form.toldNumber ? `: ${form.toldNumber}` : ""} — open section 5 with "When the recruiter already told you the number"`
      : null,
    form.salaryStage === "not_asked"
      ? 'Nobody has asked them about salary and they do not expect it — open section 5 with "When the question has not come up"'
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

const COMP_STATUS_LABELS = {
  not_discussed: "They have not talked numbers yet",
  recruiter_shared_range: "The recruiter shared a range",
  i_shared_number: "The candidate already shared a number or range",
  both_shared: "Both sides have shared numbers",
};

const OTHER_PROCESS_LABELS = {
  none: "No other active processes. This is their only one, so write NO lines about other opportunities or competing offers anywhere in the script",
  interviewing_elsewhere:
    "Interviewing elsewhere, no offer yet. They may truthfully say they are in consideration for other roles, never that they have an offer",
  expecting_offer: "Expecting another offer in the next 1-2 weeks",
  have_offer: "Already has another offer in hand",
};

const CALL_TIMING_LABELS = {
  scheduled: "The offer call is scheduled",
  any_day: "Expecting the call any day now",
  not_sure: "Not sure when the call will come",
};

// Compares the recruiter's stated band against the researched range. Only
// emitted when the recruiter actually shared one; the script uses it to
// explain that a low band is an opening position, not the market.
export function recruiterRangeCheck(form, analysis) {
  const high = parseMoney(form.recruiterRangeHigh);
  if (high === null) return null;
  const base = analysis.market_range?.base;
  if (!base) return null;
  if (typeof base.low === "number" && high < base.low) {
    return "RECRUITER RANGE CHECK: the top of the recruiter's range is below the walk-away floor";
  }
  if (typeof base.target === "number" && high < base.target) {
    return "RECRUITER RANGE CHECK: the top of the recruiter's range is below the market target";
  }
  return null;
}

// Only the candidate sharing a number triggers the recovery section. The
// recruiter sharing a range is a different situation and must not, which the
// model got wrong when left to interpret compStatus itself.
const CANDIDATE_SHARED = ["i_shared_number", "both_shared"];

// The wide-range answer's two numbers, computed here rather than left to the
// model. Asking it to pick "the floor" vs "the target" off a strategy label
// produced the wrong low end for aggressive, so the values are handed over
// already resolved.
export function wideRangeAnswer(analysis, strategy, baseFloor, totalFloor) {
  const range = analysis.market_range;
  if (!range?.base) return null;

  const useTotal = Boolean(range.total_comp);
  const points = useTotal ? range.total_comp : range.base;
  const floor = (useTotal ? totalFloor : baseFloor) ?? points.low;

  // Cautious and balanced open at the walk-away floor; only aggressive lifts
  // the low end to the target.
  const low = strategy === "aggressive" ? points.target : floor;
  const measure = useTotal ? "total compensation" : "base salary";
  return `WIDE RANGE ANSWER: LOW = ${fmtMoney(low)}, HIGH = ${fmtMoney(points.stretch)} (these are ${measure} figures, already resolved for the ${strategy} strategy — use them exactly as given, do not recompute, and say which measure you quoted)`;
}

function buildOfferSoonUserMessage(form, analysis) {
  const { baseFloor, totalFloor, note } = applyFloors(form, analysis);

  const recruiterRange =
    form.recruiterRangeLow || form.recruiterRangeHigh
      ? `Recruiter's stated range: $${form.recruiterRangeLow || "?"} to $${form.recruiterRangeHigh || "?"}`
      : null;

  const priorities =
    Array.isArray(form.priorities) && form.priorities.length
      ? `What matters beyond base salary (prioritize the call questions around these): ${form.priorities.join(", ")}`
      : null;

  const lines = [
    "Job-search stage: Expecting an offer soon. The next call is the offer call itself.",
    `Role: ${form.targetRole}`,
    `Company: ${form.targetCompany}`,
    `Location: ${form.location}`,
    `Years of experience: ${form.yearsExperience}`,
    `Where compensation stands: ${COMP_STATUS_LABELS[form.compStatus] || form.compStatus}`,
    recruiterRange,
    form.sharedNumber
      ? `Number or range they already shared: ${form.sharedNumber} — include the "if you already shared a number" section`
      : null,
    `Other opportunities: ${OTHER_PROCESS_LABELS[form.otherProcesses] || form.otherProcesses}`,
    form.otherCompExpected
      ? `Total comp they expect from the other opportunity: $${form.otherCompExpected} — use this figure only in the competing-offer line`
      : null,
    form.callTiming ? CALL_TIMING_LABELS[form.callTiming] : null,
    priorities,
    baseFloor !== null
      ? `WALK-AWAY FLOOR (base): ${fmtMoney(baseFloor)}`
      : "WALK-AWAY FLOOR (base): unavailable — no researched range, use fill-in blanks",
    totalFloor !== null
      ? `WALK-AWAY FLOOR (total compensation): ${fmtMoney(totalFloor)}${note}`
      : null,
    recruiterRangeCheck(form, analysis),
    CANDIDATE_SHARED.includes(form.compStatus)
      ? "RECOVERY SECTION: include it — the candidate shared a number themselves"
      : "RECOVERY SECTION: omit it entirely — the candidate has NOT shared a number of their own",
    form.otherProcesses === "none"
      ? "LEVERAGE: they have no other opportunities. Write NOTHING anywhere in the script about other offers, competing offers, or other opportunities, not even to note that they lack them. Their leverage is the company's investment in them plus the market data, and that is how you phrase it."
      : null,
    form.additionalContext
      ? `Additional context from the candidate: ${form.additionalContext}`
      : null,
  ].filter(Boolean);

  const strategyName =
    { Cautious: "cautious", Balanced: "balanced", Aggressive: "aggressive" }[
      form.riskTolerance
    ] || "balanced";

  const wide = wideRangeAnswer(analysis, strategyName, baseFloor, totalFloor);
  if (wide) lines.push(wide);

  return [
    "Write the offer call script for this candidate.",
    "",
    "CANDIDATE DETAILS:",
    lines.join("\n"),
    "",
    `RECOMMENDED STRATEGY: ${strategyName} (from their stated risk tolerance${form.riskTolerance ? `: "${form.riskTolerance}"` : ""}) — use it to pick the recommended approach in Scenario B and to set the width of the wide-range answer`,
    "",
    "EXPECTING-AN-OFFER-SOON ANALYSIS THEY RECEIVED:",
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

// The full message for one candidate, including any resume and job description
// saved with their analysis. Missing context just means going without it.
export async function buildScriptMessage(redis, flow, form, analysis) {
  let message;
  if (flow === "offer_soon") {
    message = buildOfferSoonUserMessage(form, analysis);
  } else if (SCREENING_FLOWS.includes(flow)) {
    message = buildApplyUserMessage(form, analysis, flow);
  } else {
    message = buildUserMessage(form, analysis);
  }
  if (analysis.submissionId && redis) {
    try {
      const record = await getSubmission(redis, analysis.submissionId);
      if (record?.resumeText) {
        message +=
          flow !== "offer"
            ? `\n\nCANDIDATE RESUME (optional context — use it to make the closing questions specific to their background):\n${record.resumeText}`
            : `\n\nCANDIDATE RESUME (optional context: use it to make their one-line pitch and counter specific to their background):\n${record.resumeText}`;
      }
      if (record?.jobDescriptionText) {
        message += `\n\nJOB DESCRIPTION (optional context):\n${record.jobDescriptionText}`;
      }
    } catch (err) {
      console.error("Failed to load stored context for script:", err);
    }
  }
  return message;
}
