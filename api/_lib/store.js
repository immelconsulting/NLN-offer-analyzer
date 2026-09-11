import { Redis } from "@upstash/redis";

// Shared Upstash Redis helpers for submission storage. Files under api/_lib
// are not deployed as serverless functions (underscore prefix), just imported.

const SUBS_LIST = "nln:subs"; // all submission ids, newest first
const subKey = (id) => `nln:sub:${id}`;
const emailKey = (email) => `nln:subs:email:${email.trim().toLowerCase()}`;

// Funnel events. The list is capped (see EVENTS_MAX) because it's only for
// eyeballing recent activity; the per-day counters are what the admin rollup
// reads, so summarizing never has to scan the list.
export const EVENTS_LIST = "nln:events";
export const EVENTS_MAX = 5000;
export const eventCountKey = (event, day) => `nln:events:count:${event}:${day}`;

// UTC date stamp (YYYY-MM-DD) used in the daily counter keys.
export function eventDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// Every event the app is allowed to record, in funnel order. Anything not on
// this list is rejected by /api/event, so a typo or a rogue caller can't
// quietly create new keys.
export const TRACKED_EVENTS = [
  "results_viewed",
  "script_cta_clicked",
  "session_cta_clicked",
  "proof_viewed",
  "session_viewed",
  "script_checkout_clicked",
  "session_checkout_clicked",
  "script_generated",
  "booking_confirmed",
];

export function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function newSubmissionId() {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Stores a new submission record and indexes it. History is append-only:
// every submission gets its own record, nothing is overwritten.
export async function saveSubmission(redis, record) {
  await redis.set(subKey(record.id), JSON.stringify(record));
  await redis.lpush(SUBS_LIST, record.id);
  if (record.email) {
    await redis.lpush(emailKey(record.email), record.id);
  }
}

export async function getSubmission(redis, id) {
  const raw = await redis.get(subKey(id));
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function updateSubmission(redis, id, patch) {
  const existing = await getSubmission(redis, id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await redis.set(subKey(id), JSON.stringify(updated));
  return updated;
}

// Funnel rollup from the per-day counters only — one mget, never a scan of
// the events list. Returns { event: { today, week } } per tracked event,
// where week is the trailing 7 days including today.
export async function getFunnelCounts(redis, today = new Date()) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(eventDay(d));
  }

  const keys = TRACKED_EVENTS.flatMap((event) =>
    days.map((day) => eventCountKey(event, day))
  );
  const values = await redis.mget(...keys);

  const counts = {};
  TRACKED_EVENTS.forEach((event, i) => {
    const nums = values
      .slice(i * days.length, (i + 1) * days.length)
      .map((v) => Number(v) || 0);
    counts[event] = {
      today: nums[0], // days[0] is today
      week: nums.reduce((a, b) => a + b, 0),
    };
  });
  return counts;
}

// Most recent submissions, capped. Used by the admin list and the
// comparables lookup.
export async function listRecentSubmissions(redis, limit = 200) {
  const ids = await redis.lrange(SUBS_LIST, 0, limit - 1);
  if (!ids || ids.length === 0) return [];
  const raws = await redis.mget(...ids.map(subKey));
  return raws
    .filter(Boolean)
    .map((r) => (typeof r === "string" ? JSON.parse(r) : r));
}
