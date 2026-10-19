import { Redis } from "@upstash/redis";
import { rejectIfOverLimit } from "./_lib/rateLimit.js";
import { isAuthorized } from "./_lib/auth.js";
import { linkVisitor, recordEvent, stageToFlow, isVisitorId } from "./_lib/events.js";

// Stores one lead per request in an Upstash Redis list. Requires
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
// (created automatically when you add Upstash Redis from the
// Vercel Marketplace and connect it to this project).
//
// Also links the browser's visitor id to this email and records a
// lead_captured event, which is how the admin dashboard ties a person's
// page visits to them (see api/_lib/events.js). That part never blocks the
// lead from being saved.

const LEADS_KEY = "nln:leads";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, stage, marketingOptIn, vid } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !stage) {
    return res.status(400).json({ error: "A valid email and stage are required." });
  }
  if (await rejectIfOverLimit(req, res, "lead")) return;

  // Vercel's Upstash integration names these KV_*; a manual Upstash setup
  // uses UPSTASH_*. Accept either.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("Lead not stored: Upstash Redis env vars are missing.");
    return res.status(500).json({ error: "Lead storage is not configured." });
  }

  try {
    const redis = new Redis({ url, token });
    await redis.rpush(
      LEADS_KEY,
      JSON.stringify({
        email: email.trim().toLowerCase(),
        stage,
        marketingOptIn: marketingOptIn === true,
        timestamp: new Date().toISOString(),
      })
    );
    try {
      const cleanEmail = email.trim().toLowerCase();
      await linkVisitor(redis, vid, cleanEmail);
      await recordEvent(redis, {
        e: "lead_captured",
        email: cleanEmail,
        vid: isVisitorId(vid) ? vid : undefined,
        flow: stageToFlow(stage) || undefined,
        internal: isAuthorized(req) ? true : undefined,
      });
    } catch (err) {
      console.error("Lead saved, but linking the visitor failed:", err);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to store lead:", err);
    return res.status(502).json({ error: "Could not store lead." });
  }
}
