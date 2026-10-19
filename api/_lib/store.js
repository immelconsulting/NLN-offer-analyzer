import { Redis } from "@upstash/redis";

// Shared Upstash Redis helpers for submission storage. Files under api/_lib
// are not deployed as serverless functions (underscore prefix), just imported.

const SUBS_LIST = "nln:subs"; // all submission ids, newest first
const subKey = (id) => `nln:sub:${id}`;
const emailKey = (email) => `nln:subs:email:${email.trim().toLowerCase()}`;

// UTC date stamp (YYYY-MM-DD) used in per-day keys (events, rate limits).
export function eventDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

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

// Newest first, since saveSubmission pushes onto the front.
export async function listSubmissionIdsByEmail(redis, email, limit = 10) {
  return (await redis.lrange(emailKey(email), 0, limit - 1)) || [];
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

// Longest window the dashboard will read (one event list per day), so a bad
// ?start= can't ask for thousands of keys. A year (the longest preset) fits comfortably under it.
export const MAX_RANGE_DAYS = 400;

// The day N calendar months before the given day. Day-of-month is clamped to
// the target month's length, so 1 month before Mar 31 is Feb 28 (or Feb 29 in
// a leap year) rather than rolling forward into March.
export function shiftMonths(day, months) {
  const [y, m, d] = day.split("-").map(Number);
  const firstOfTarget = new Date(Date.UTC(y, m - 1 - months, 1));
  const daysInTarget = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(d, daysInTarget));
  return eventDay(firstOfTarget);
}

// The day N days before the given day (N=1 means the day itself, so a
// "7 days" range covers today plus the six before it).
export function shiftDays(day, days) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return eventDay(d);
}

// Every UTC day stamp from startDay to endDay, inclusive.
export function dayRange(startDay, endDay) {
  const cursor = new Date(`${startDay}T00:00:00Z`);
  const last = new Date(`${endDay}T00:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) return [];

  const days = [];
  while (cursor <= last && days.length < MAX_RANGE_DAYS) {
    days.push(eventDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
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
