import { Redis } from "@upstash/redis";
import {
  EVENTS_LIST,
  EVENTS_MAX,
  TRACKED_EVENTS,
  eventCountKey,
  eventDay,
} from "./_lib/store.js";

// Records one funnel event per request. Same storage pattern as lead.js.
// Unauthenticated by design — these are anonymous counts, never PII — but the
// event name must be on the TRACKED_EVENTS allowlist, so this can't be used
// to write arbitrary keys.
//
// Writes twice per event: onto a capped list (recent activity, eyeballing)
// and into a per-day counter (what /api/admin's rollup reads, so summarizing
// never scans the list).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, meta } = req.body || {};
  if (!event || !TRACKED_EVENTS.includes(event)) {
    return res.status(400).json({ error: "Unknown event." });
  }

  // Vercel's Upstash integration names these KV_*; a manual Upstash setup
  // uses UPSTASH_*. Accept either.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("Event not stored: Upstash Redis env vars are missing.");
    return res.status(500).json({ error: "Event storage is not configured." });
  }

  try {
    const redis = new Redis({ url, token });
    await redis.rpush(
      EVENTS_LIST,
      JSON.stringify({
        event,
        meta: meta && typeof meta === "object" ? meta : {},
        timestamp: new Date().toISOString(),
      })
    );
    // Keep only the most recent EVENTS_MAX entries.
    await redis.ltrim(EVENTS_LIST, -EVENTS_MAX, -1);
    await redis.incr(eventCountKey(event, eventDay()));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to store event:", err);
    return res.status(502).json({ error: "Could not store event." });
  }
}
