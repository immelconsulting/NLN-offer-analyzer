import {
  getRedis,
  getSubmission,
  listRecentSubmissions,
  getFunnelCounts,
  eventDay,
  MAX_RANGE_DAYS,
} from "./_lib/store.js";

// Read-only admin API, protected by the same token as the leads export:
//   GET /api/admin?token=X                    -> submission list (newest first)
//   GET /api/admin?token=X&q=alice           -> filtered by email/role/company/location
//   GET /api/admin?token=X&range=30          -> trailing 30 days (preset)
//   GET /api/admin?token=X&start=&end=       -> custom YYYY-MM-DD range
//   GET /api/admin?token=X&id=sub_...        -> one full record
//   GET /api/admin?token=X&export=full       -> CSV of everything
//   GET /api/admin?token=X&export=salary     -> CSV of salary-relevant fields only
//
// The date range drives both the funnel rollup and the submission list (and
// therefore the CSV exports), so the page has one control rather than two
// that disagree.

const LIST_LIMIT = 500;

// Trailing-day presets the UI offers. 1 = today only.
const RANGE_PRESETS = [1, 7, 30, 90, 120, 365];
const DEFAULT_RANGE = 7;

const isDayStamp = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function trailingStart(endDay, days) {
  const d = new Date(`${endDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return eventDay(d);
}

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
    const earliest = trailingStart(end, MAX_RANGE_DAYS);
    if (start < earliest) start = earliest;
    return { start, end, preset: null };
  }

  const preset = RANGE_PRESETS.includes(Number(query.range))
    ? Number(query.range)
    : DEFAULT_RANGE;
  return { start: trailingStart(today, preset), end: today, preset };
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

function matchesQuery(sub, q) {
  const hay = [
    sub.email,
    sub.form?.role,
    sub.form?.company,
    sub.form?.location,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = process.env.LEADS_EXPORT_TOKEN;
  if (!expected || req.query.token !== expected) {
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
    const subs = all.filter((s) => inRange(s, range));

    if (req.query.export === "full") {
      const lines = [
        "timestamp,email,role,company,location,industry,current_salary,offer_base_salary,bonus,sign_on,equity,top_priority,risk_tolerance,deadline,has_leverage,leverage_details,additional_context,offer_score,internal_data_used,has_script",
      ];
      for (const s of subs) {
        const f = s.form || {};
        lines.push(
          toRow([
            s.timestamp, s.email, f.role, f.company, f.location, f.industry,
            f.currentSalary, f.offerBaseSalary,
            f.hasBonus ? f.bonusAmount : "",
            f.hasSignOnBonus ? f.signOnBonusAmount : "",
            f.hasEquity ? f.equityAmount : "",
            f.topPriority, f.riskTolerance, f.offerDeadline,
            f.hasLeverage ? "yes" : "no", f.leverageDetails, f.additionalContext,
            s.analysis?.offerScore,
            s.analysis?.internalDataUsed ? "yes" : "no",
            s.script ? "yes" : "no",
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
      for (const s of subs) {
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
        email: s.email,
        role: s.form?.role,
        company: s.form?.company,
        location: s.form?.location,
        offerBaseSalary: s.form?.offerBaseSalary,
        offerScore: s.analysis?.offerScore,
        internalDataUsed: Boolean(s.analysis?.internalDataUsed),
        hasScript: Boolean(s.script),
      })),
    });
  } catch (err) {
    console.error("Admin request failed:", err);
    return res.status(502).json({ error: "Admin request failed." });
  }
}
