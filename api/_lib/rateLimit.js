import { getRedis } from "./store.js";
import { isAuthorized } from "./auth.js";
import { CONTACT_EMAIL } from "../../src/lib/config.js";

// Per-visitor daily caps, counted in Redis by IP address and UTC day. Each
// analysis runs live web searches and model calls that cost real money, so
// without a cap one person or bot could run up the bill. Alex, logged in to
// /admin in the same browser, is exempt so testing never trips it.
//
// Fails open: if Redis is unreachable, the request goes through. A storage
// hiccup should never block a real customer.

export const DAILY_LIMITS = {
  // Shared across all four flows, so switching stages doesn't reset it.
  analysis: 10,
  // Generous: these exist to stop junk floods, not real visitors.
  lead: 30,
  event: 500,
};

const LIMIT_MESSAGES = {
  analysis: `You've reached today's limit of ${DAILY_LIMITS.analysis} analyses. Please try again tomorrow, or email ${CONTACT_EMAIL} if you need help sooner.`,
  lead: "Too many sign-ups from this connection today. Please try again tomorrow.",
  event: "Too many requests.",
};

// Vercel sets both headers itself and overwrites any value the visitor
// sends, so they can't be spoofed to dodge the limit.
export function clientIp(req) {
  const h = req.headers || {};
  return h["x-real-ip"] || String(h["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
}

export async function checkDailyLimit(req, bucket) {
  if (isAuthorized(req)) return { allowed: true };
  const redis = getRedis();
  if (!redis) return { allowed: true };
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `nln:rl:${bucket}:${day}:${clientIp(req)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60 * 60 * 48);
    return { allowed: count <= DAILY_LIMITS[bucket], count };
  } catch (err) {
    console.error("Rate limit check failed (allowing request):", err);
    return { allowed: true };
  }
}

// Convenience for handlers: sends the 429 and returns true when over the cap.
export async function rejectIfOverLimit(req, res, bucket) {
  const { allowed } = await checkDailyLimit(req, bucket);
  if (allowed) return false;
  res.status(429).json({ error: LIMIT_MESSAGES[bucket] });
  return true;
}
