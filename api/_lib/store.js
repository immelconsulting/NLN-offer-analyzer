import { Redis } from "@upstash/redis";

// Shared Upstash Redis helpers for submission storage. Files under api/_lib
// are not deployed as serverless functions (underscore prefix), just imported.

const SUBS_LIST = "nln:subs"; // all submission ids, newest first
const subKey = (id) => `nln:sub:${id}`;
const emailKey = (email) => `nln:subs:email:${email.trim().toLowerCase()}`;

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
