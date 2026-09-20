import {
  getRedis,
  getSubmission,
  listRecentSubmissions,
  getFunnelCounts,
  eventDay,
  shiftDays,
  shiftMonths,
  MAX_RANGE_DAYS,
} from "./_lib/store.js";
import { isAuthorized } from "./_lib/auth.js";

// Read-only admin API. Requires the session cookie from /api/login — there
// is no query-parameter token, so a URL alone never grants access.
//   GET /api/admin                    -> submission list (newest first)
//   GET /api/admin?q=alice           -> filtered by email/role/company/location
//   GET /api/admin?range=3m          -> preset window (1d/7d/30d/3m/4m/6m/12m)
//   GET /api/admin?start=&end=       -> custom YYYY-MM-DD range
//   GET /api/admin?id=sub_...        -> one full record
//   GET /api/admin?export=full       -> CSV of everything
//   GET /api/admin?export=salary     -> CSV of salary-relevant fields only
//
// The date range drives both the funnel rollup and the submission list (and
// therefore the CSV exports), so the page has one control rather than two
// that disagree.

const LIST_LIMIT = 500;

// Presets the UI offers, keyed by the id sent as ?range=. Short windows stay
// in days; longer ones are calendar months, so "3 months" back from Sep 12 is
// Jun 12 rather than an approximate 90 days.
const RANGE_PRESETS = {
  "1d": (end) => shiftDays(end, 1),
  "7d": (end) => shiftDays(end, 7),
  "30d": (end) => shiftDays(end, 30),
  "3m": (end) => shiftMonths(end, 3),
  "4m": (end) => shiftMonths(end, 4),
  "6m": (end) => shiftMonths(end, 6),
  "12m": (end) => shiftMonths(end, 12),
};
const DEFAULT_RANGE = "7d";

// Numeric ?range= values predate the month presets; map the ones that were
// offered so old links keep working.
const LEGACY_RANGES = {
  1: "1d",
  7: "7d",
  30: "30d",
  90: "3m",
  120: "4m",
  365: "12m",
};

const isDayStamp = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Turns the query string into an inclusive {start, end} pair of UTC day
// stamps. Anything malformed, inverted, in the future, or longer than
// MAX_RANGE_DAYS is corrected rather than rejected — this is a private page
// and a usable range beats an error message.
// Exported for tests; Vercel only ever calls the default export.
export function resolveRange(query) {
  const today = eventDay();

  if (isDayStamp(query.start) && isDayStamp(query.end)) {
    let [start, end] =
      query.start <= query.end
        ? [query.start, query.end]
        : [query.end, query.start];
    if (end > today) end = today;
    if (start > end) start = end;
    const earliest = shiftDays(end, MAX_RANGE_DAYS);
    if (start < earliest) start = earliest;
    return { start, end, preset: null };
  }

  const asked = String(query.range ?? "");
  const preset = RANGE_PRESETS[asked]
    ? asked
    : LEGACY_RANGES[Number(asked)] || DEFAULT_RANGE;
  return { start: RANGE_PRESETS[preset](today), end: today, preset };
}

// Submission timestamps are ISO strings, so the date half compares directly
// against the day stamps.
function inRange(sub, range) {
  const day = String(sub.timestamp || "").slice(0, 10);
  return day >= range.start && day <= range.end;
}

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toRow(values) {
  return values.map(csvEscape).join(",");
}

// Records predate the flow field, so anything unmarked is an offer.
const flowOf = (sub) => (sub.flow === "apply" ? "apply" : "offer");

// The two flows name the role and company differently.
const roleOf = (sub) => sub.form?.role || sub.form?.targetRole || "";
const companyOf = (sub) => sub.form?.company || sub.form?.targetCompany || "";

function matchesQuery(sub, q) {
  const hay = [sub.email, roleOf(sub), companyOf(sub), sub.form?.location]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: "Storage is not configured." });
  }

  try {
    if (req.query.id) {
      const sub = await getSubmission(redis, req.query.id);
      if (!sub) return res.status(404).json({ error: "Not found" });
      return res.status(200).json(sub);
    }

    const range = resolveRange(req.query);
    const all = await listRecentSubmissions(redis, LIST_LIMIT);
    const flowFilter = ["offer", "apply"].includes(req.query.flow)
      ? req.query.flow
      : null;
    const subs = all.filter(
      (s) => inRange(s, range) && (!flowFilter || flowOf(s) === flowFilter)
    );

    if (req.query.export === "full") {
      const lines = [
        "timestamp,flow,email,role,company,location,industry,current_salary,offer_base_salary,bonus,sign_on,equity,top_priority,risk_tolerance,deadline,has_leverage,leverage_details,additional_context,offer_score,internal_data_used,has_script,has_resume,has_job_description,years_experience,salary_stage,shared_number,range_low,range_target,range_stretch,range_confidence",
      ];
      for (const s of subs) {
        const f = s.form || {};
        const base = s.analysis?.market_range?.base || {};
        lines.push(
          toRow([
            s.timestamp, flowOf(s), s.email, roleOf(s), companyOf(s), f.location, f.industry,
            f.currentSalary, f.offerBaseSalary,
            f.hasBonus ? f.bonusAmount : "",
            f.hasSignOnBonus ? f.signOnBonusAmount : "",
            f.hasEquity ? f.equityAmount : "",
            f.topPriority, f.riskTolerance, f.offerDeadline,
            f.hasLeverage ? "yes" : "no", f.leverageDetails, f.additionalContext,
            s.analysis?.offerScore,
            s.analysis?.internalDataUsed ? "yes" : "no",
            s.script ? "yes" : "no",
            s.resumeText ? "yes" : "no",
            s.jobDescriptionText ? "yes" : "no",
            // Apply-flow only; blank on offer rows.
            f.yearsExperience, f.salaryStage, f.sharedNumber,
            base.low, base.target, base.stretch, s.analysis?.confidence,
          ])
        );
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="nln-submissions.csv"');
      return res.status(200).send(lines.join("\n"));
    }

    if (req.query.export === "salary") {
      const lines = [
        "timestamp,role,location,industry,offer_base_salary,bonus,sign_on,equity",
      ];
      // Offer rows only. Apply-stage submissions carry target ranges rather
      // than real offers, so mixing them in would quietly corrupt this as a
      // market-data export — the same reason they're excluded from
      // comparables.
      for (const s of subs.filter((x) => flowOf(x) === "offer")) {
        const f = s.form || {};
        lines.push(
          toRow([
            s.timestamp, f.role, f.location, f.industry, f.offerBaseSalary,
            f.hasBonus ? f.bonusAmount : "",
            f.hasSignOnBonus ? f.signOnBonusAmount : "",
            f.hasEquity ? f.equityAmount : "",
          ])
        );
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="nln-salary-data.csv"');
      return res.status(200).send(lines.join("\n"));
    }

    const q = (req.query.q || "").trim().toLowerCase();
    const filtered = q ? subs.filter((s) => matchesQuery(s, q)) : subs;

    // Rollup rides along on the list response so the admin page doesn't need
    // a second request. A counter read failing shouldn't cost Alex the
    // submissions table, so it degrades to null.
    let funnel = null;
    try {
      funnel = await getFunnelCounts(redis, range.start, range.end);
    } catch (err) {
      console.error("Funnel rollup failed:", err);
    }

    // List view: summaries only, full record fetched by id on click.
    // `range` is echoed back so the page can label what it's showing —
    // including when a request was corrected (future end date, over-long span).
    return res.status(200).json({
      funnel,
      range,
      submissionsCapped: all.length >= LIST_LIMIT,
      submissions: filtered.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        flow: flowOf(s),
        email: s.email,
        role: roleOf(s),
        company: companyOf(s),
        location: s.form?.location,
        industry: s.form?.industry,
        offerBaseSalary: s.form?.offerBaseSalary,
        // Apply rows have a researched target instead of an offer.
        rangeTarget: s.analysis?.market_range?.base?.target ?? null,
        topPriority: s.form?.topPriority,
        riskTolerance: s.form?.riskTolerance,
        offerScore: s.analysis?.offerScore,
        internalDataUsed: Boolean(s.analysis?.internalDataUsed),
        hasScript: Boolean(s.script),
        // Length, not content — enough for the table to show whether a
        // resume came in without shipping the whole text to the list view.
        resumeChars: s.resumeText ? s.resumeText.length : 0,
        jobDescriptionChars: s.jobDescriptionText
          ? s.jobDescriptionText.length
          : 0,
      })),
    });
  } catch (err) {
    console.error("Admin request failed:", err);
    return res.status(502).json({ error: "Admin request failed." });
  }
}
