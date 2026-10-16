import { getSubmission, listSubmissionIdsByEmail } from "./store.js";

// What Jenny sees about a session buyer before the call: a plain-text summary
// of their most recent Job Offer Analyzer submission (matched on the email
// they paid with), plus their script and any resume / job description text
// as attachments. Covered by the JobJenny line in the privacy policy.
//
// Only text was ever stored for uploads (never the original files), so the
// attachments are .txt.

const FLOW_LABELS = {
  offer: "Received an offer",
  apply: "Applying",
  interview: "Interviewing",
  offer_soon: "Expecting an offer soon",
};

const SALARY_STAGE_LABELS = {
  no_call: "No recruiter call yet",
  call_scheduled: "A recruiter call is scheduled or coming up",
  dodged: "A recruiter asked and they dodged it",
  gave_number: "They already gave a number",
};

const COMP_STATUS_LABELS = {
  not_discussed: "Haven't talked numbers yet",
  recruiter_shared_range: "Recruiter shared a range",
  i_shared_number: "They already shared a number",
  both_shared: "Both sides have shared numbers",
};

const OTHER_PROCESS_LABELS = {
  none: "None, this is their only process",
  interviewing_elsewhere: "Interviewing elsewhere, no offer yet",
  expecting_offer: "Expecting another offer in the next 1-2 weeks",
  have_offer: "Already has another offer in hand",
};

const CALL_TIMING_LABELS = {
  scheduled: "Offer call is scheduled",
  any_day: "Offer call could come any day",
  not_sure: "Not sure when the offer call is",
};

// Offer-flow strategies are keyed conservative/balanced/aggressive.
const RISK_TO_OFFER_STRATEGY = {
  Cautious: "conservative",
  Balanced: "balanced",
  Aggressive: "aggressive",
};

const money = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? `$${Math.round(n).toLocaleString("en-US")}` : String(v);
};

const range = (r) =>
  r ? `${money(r.low)} / ${money(r.target)} / ${money(r.stretch)} (low / target / stretch)` : null;

const line = (label, value) => (value ? `${label}: ${value}` : null);

function roleLine(role, company, location) {
  return `${role || "(role not given)"}${company ? ` at ${company}` : ""}${location ? ` · ${location}` : ""}`;
}

function offerSummary(form, analysis) {
  const parts = [`${money(form.offerBaseSalary)} base`];
  if (form.hasBonus && form.bonusAmount) parts.push(`bonus ${form.bonusAmount}`);
  if (form.hasSignOnBonus && form.signOnBonusAmount) parts.push(`${money(form.signOnBonusAmount)} sign-on`);
  if (form.hasEquity && form.equityAmount) parts.push(`equity ${form.equityAmount}`);

  const strategy =
    analysis?.strategies?.[RISK_TO_OFFER_STRATEGY[form.riskTolerance] || "balanced"];
  const opportunities = (analysis?.opportunities || [])
    .slice(0, 3)
    .map((o) => `  - ${o.title}${o.estimatedImpact ? ` (${o.estimatedImpact})` : ""}`);

  return [
    line("Role", roleLine(form.role, form.company, form.location)),
    line("Industry", form.industry),
    line("Offer", parts.join(" · ")),
    line("Current base salary", money(form.currentSalary)),
    line("Top priority", form.topPriority),
    line("Risk tolerance", form.riskTolerance),
    line("Deadline", form.offerDeadline),
    line("Competing offers / leverage", form.hasLeverage ? form.leverageDetails || "Yes" : null),
    line("Their notes", form.additionalContext),
    "",
    line(
      "Offer score",
      analysis?.offerScore != null
        ? `${analysis.offerScore}/100${analysis.scoreInterpretation ? `: ${analysis.scoreInterpretation}` : ""}`
        : null
    ),
    opportunities.length ? `Biggest opportunities:\n${opportunities.join("\n")}` : null,
    strategy
      ? line("Recommended strategy", `${strategy.name}: ${strategy.expectedOutcome}`)
      : null,
    line("Recommended next step", analysis?.recommendedNextStep),
  ];
}

function preOfferSummary(flow, form, analysis) {
  const strategy = (analysis?.three_strategies || []).find(
    (s) => s.id === analysis?.recommended_strategy
  );
  const mr = analysis?.market_range;
  const isOfferSoon = flow === "offer_soon";
  const recruiterRange =
    form.recruiterRangeLow || form.recruiterRangeHigh
      ? `${money(form.recruiterRangeLow) || "?"} to ${money(form.recruiterRangeHigh) || "?"}`
      : null;

  return [
    line("Role", roleLine(form.targetRole, form.targetCompany, form.location)),
    line("Years of experience", form.yearsExperience),
    isOfferSoon
      ? line("Where comp stands", COMP_STATUS_LABELS[form.compStatus])
      : line("Salary question", SALARY_STAGE_LABELS[form.salaryStage]),
    line("Recruiter's range", recruiterRange),
    line("Number they already shared", form.sharedNumber),
    isOfferSoon ? line("Other opportunities", OTHER_PROCESS_LABELS[form.otherProcesses]) : null,
    isOfferSoon ? line("Expected comp elsewhere", form.otherCompExpected) : null,
    isOfferSoon ? line("Offer call timing", CALL_TIMING_LABELS[form.callTiming]) : null,
    isOfferSoon && form.priorities?.length ? line("Priorities", form.priorities.join(", ")) : null,
    line("Current total comp", money(form.currentTotalComp)),
    line("Risk tolerance", form.riskTolerance),
    line("Their notes", form.additionalContext),
    "",
    mr ? line("Researched base range", range(mr.base)) : "Researched range: none (no usable market data was found)",
    mr?.total_comp ? line("Researched total comp range", range(mr.total_comp)) : null,
    line("Confidence", analysis?.confidence),
    isOfferSoon ? line("How to read the offer", analysis?.offer_benchmark_note) : null,
    line("Biggest risk", analysis?.biggest_risk),
    isOfferSoon ? line("Leverage", analysis?.leverage_read) : null,
    strategy ? line("Recommended strategy", `${strategy.style}: ${strategy.summary}`) : null,
  ];
}

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "unknown date";

const toAttachment = (filename, text) => ({
  filename,
  content: Buffer.from(text, "utf8").toString("base64"),
});

// Returns { text, attachments } to append to the alert. Never throws: a
// storage problem just means the alert goes out without the extra context.
export async function buildClientContext(redis, email) {
  const header = "── FROM THE JOB OFFER ANALYZER ──";
  const notFound = {
    text: [
      header,
      `No analyzer history found for ${email || "this buyer"}. If they used a different email in the tool, Alex can look them up on the admin page.`,
    ].join("\n"),
    attachments: [],
  };
  if (!redis || !email) return notFound;

  try {
    const ids = await listSubmissionIdsByEmail(redis, email, 10);
    if (!ids.length) return notFound;
    const sub = await getSubmission(redis, ids[0]);
    if (!sub) return notFound;

    const flow = sub.flow || "offer";
    const form = sub.form || {};
    const body =
      flow === "offer" ? offerSummary(form, sub.analysis) : preOfferSummary(flow, form, sub.analysis);

    const attachments = [];
    if (sub.resumeText) attachments.push(toAttachment("resume.txt", sub.resumeText));
    if (sub.jobDescriptionText) attachments.push(toAttachment("job-description.txt", sub.jobDescriptionText));
    if (sub.script) attachments.push(toAttachment("their-script.txt", sub.script));

    const attached = [
      sub.resumeText && "resume.txt",
      sub.jobDescriptionText && "job-description.txt",
      sub.script && "their-script.txt (the $47 script they bought)",
    ].filter(Boolean);

    const lines = [
      `${header} (submitted ${fmtDate(sub.timestamp)})`,
      line("Stage", FLOW_LABELS[flow] || flow),
      ...body,
      "",
      attached.length ? `Attached: ${attached.join(", ")}` : "No resume, job description, or script on file.",
      ids.length > 1
        ? `They've used the analyzer ${ids.length} times; this is the most recent. The rest are on the admin page.`
        : null,
    ].filter((l) => l !== null);

    return { text: lines.join("\n"), attachments };
  } catch (err) {
    console.error("Client context lookup failed:", err);
    return notFound;
  }
}
