import {
  getRedis,
  getSubmission,
  listRecentSubmissions,
} from "./_lib/store.js";

// Read-only admin API, protected by the same token as the leads export:
//   GET /api/admin?token=X                -> submission list (newest first)
//   GET /api/admin?token=X&q=alice       -> filtered by email/role/company/location
//   GET /api/admin?token=X&id=sub_...    -> one full record
//   GET /api/admin?token=X&export=full   -> CSV of everything
//   GET /api/admin?token=X&export=salary -> CSV of salary-relevant fields only

const LIST_LIMIT = 500;

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

    const subs = await listRecentSubmissions(redis, LIST_LIMIT);

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

    // List view: summaries only, full record fetched by id on click.
    return res.status(200).json({
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
