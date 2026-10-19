import { getRedis } from "./_lib/store.js";
import { CLIENT_EVENTS, FLOW_IDS, isVisitorId, recordEvent } from "./_lib/events.js";
import { rejectIfOverLimit } from "./_lib/rateLimit.js";
import { isAuthorized } from "./_lib/auth.js";

// Records one funnel event from the browser (src/lib/track.js). The event
// name must be on the CLIENT_EVENTS allowlist; purchases and leads are
// recorded server-side where they're verified, never accepted from here.
//
// Carries the browser's visitor id and the flow it was in, so the admin
// dashboard can count people (not clicks) and filter by flow and person.
// Anything sent from a browser logged in to /admin is marked internal and
// hidden from the dashboard, so Alex's own testing never skews the numbers.

const MAX_META_CHARS = 300;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, meta, vid, flow } = req.body || {};
  if (!event || !CLIENT_EVENTS.includes(event)) {
    return res.status(400).json({ error: "Unknown event." });
  }
  if (await rejectIfOverLimit(req, res, "event")) return;

  const redis = getRedis();
  if (!redis) {
    console.error("Event not stored: Upstash Redis env vars are missing.");
    return res.status(500).json({ error: "Event storage is not configured." });
  }

  const cleanMeta =
    meta && typeof meta === "object" && JSON.stringify(meta).length <= MAX_META_CHARS ? meta : undefined;

  try {
    await recordEvent(redis, {
      e: event,
      vid: isVisitorId(vid) ? vid : undefined,
      flow: FLOW_IDS.includes(flow) ? flow : undefined,
      meta: cleanMeta && Object.keys(cleanMeta).length ? cleanMeta : undefined,
      internal: isAuthorized(req) ? true : undefined,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Failed to store event:", err);
    return res.status(502).json({ error: "Could not store event." });
  }
}
