import { Redis } from "@upstash/redis";

// Exports all stored leads as CSV. Protected by a shared token:
//   GET /api/leads?token=<LEADS_EXPORT_TOKEN>
// Open it in a browser to download a spreadsheet-ready file.

const LEADS_KEY = "nln:leads";

function csvEscape(value) {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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

  // Vercel's Upstash integration names these KV_*; a manual Upstash setup
  // uses UPSTASH_*. Accept either.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return res.status(500).json({ error: "Lead storage is not configured." });
  }

  try {
    const redis = new Redis({ url, token });
    const rows = await redis.lrange(LEADS_KEY, 0, -1);

    const lines = ["email,stage,marketing_opt_in,timestamp"];
    for (const row of rows) {
      // Upstash may return already-parsed objects or JSON strings.
      const lead = typeof row === "string" ? JSON.parse(row) : row;
      lines.push(
        [
          lead.email,
          lead.stage,
          // Leads captured before the checkbox existed have no value —
          // export them as "no" so the opt-in column is never ambiguous.
          lead.marketingOptIn === true ? "yes" : "no",
          lead.timestamp,
        ]
          .map(csvEscape)
          .join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="nln-leads.csv"');
    return res.status(200).send(lines.join("\n"));
  } catch (err) {
    console.error("Failed to export leads:", err);
    return res.status(502).json({ error: "Could not export leads." });
  }
}
