import { Redis } from "@upstash/redis";

// Stores one lead per request in an Upstash Redis list. Requires
// UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars
// (created automatically when you add Upstash Redis from the
// Vercel Marketplace and connect it to this project).

const LEADS_KEY = "nln:leads";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, stage } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !stage) {
    return res.status(400).json({ error: "A valid email and stage are required." });
  }

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
        timestamp: new Date().toISOString(),
      })
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to store lead:", err);
    return res.status(502).json({ error: "Could not store lead." });
  }
}
