import { eventDay } from "./store.js";

// Funnel event log, one Redis list per UTC day (nln:ev:<YYYY-MM-DD>), kept
// ~13 months. Each entry is small JSON:
//   { t: ISO time, e: event name, vid?: visitor id, email?, flow?, meta?,
//     internal?: true when sent from a browser logged in to /admin }
//
// Visitor ids are random strings the browser keeps in localStorage. When a
// visitor gives their email on the landing page, /api/lead links the two in
// nln:vidmap, so earlier and later visits by that browser belong to that
// person. That's what lets the admin dashboard filter by person and flow and
// follow one person's journey (disclosed in the privacy policy).

const DAY_TTL_SECONDS = 60 * 60 * 24 * 400;
const dayKey = (day) => `nln:ev:${day}`;
export const VIDMAP_KEY = "nln:vidmap"; // hash: visitor id -> email
export const NAMES_KEY = "nln:names"; // hash: email -> name (buyers only, from Stripe)

export const FLOW_IDS = ["offer", "apply", "interview", "offer_soon"];

// Events the browser may send to /api/event. Anything else is rejected.
export const CLIENT_EVENTS = [
  "landing_viewed",
  "analysis_submitted",
  "results_viewed",
  "script_cta_clicked",
  "session_cta_clicked",
  "proof_viewed",
  "session_viewed",
  "script_checkout_clicked",
  "session_checkout_clicked",
  "script_generated",
  "script_pdf_downloaded",
  "script_pdf_failed",
  "booking_confirmed",
];

// Written only by the server, where the fact is verified (a real lead, a
// real payment), never accepted from the browser.
export const SERVER_EVENTS = ["lead_captured", "script_purchased", "session_purchased"];

// Landing-page stage labels → flow ids.
const STAGE_FLOWS = {
  "Received an offer": "offer",
  Applying: "apply",
  Interviewing: "interview",
  "Expecting an offer soon": "offer_soon",
};
export const stageToFlow = (stage) => STAGE_FLOWS[stage] || null;

export const isVisitorId = (v) => typeof v === "string" && /^[A-Za-z0-9-]{8,64}$/.test(v);

export async function recordEvent(redis, fields) {
  const entry = { t: new Date().toISOString(), ...fields };
  for (const k of Object.keys(entry)) if (entry[k] === undefined || entry[k] === null) delete entry[k];
  const key = dayKey(eventDay());
  const length = await redis.rpush(key, JSON.stringify(entry));
  if (length === 1) await redis.expire(key, DAY_TTL_SECONDS);
}

// Every event between two inclusive day stamps, oldest first.
export async function readEvents(redis, days) {
  if (!days.length) return [];
  const pipe = redis.pipeline();
  for (const day of days) pipe.lrange(dayKey(day), 0, -1);
  const lists = await pipe.exec();
  return lists
    .flat()
    .filter(Boolean)
    .map((raw) => (typeof raw === "string" ? JSON.parse(raw) : raw));
}

export async function linkVisitor(redis, vid, email) {
  if (isVisitorId(vid) && email) await redis.hset(VIDMAP_KEY, { [vid]: email.trim().toLowerCase() });
}

export async function rememberName(redis, email, name) {
  if (email && name) await redis.hset(NAMES_KEY, { [email.trim().toLowerCase()]: name });
}

// Records a purchase event once per Stripe checkout, however many times the
// webhook or the script page asks.
export async function recordPurchaseOnce(redis, checkoutId, fields) {
  const first = await redis.set(`nln:purchase-recorded:${checkoutId}`, 1, {
    nx: true,
    ex: DAY_TTL_SECONDS,
  });
  if (!first) return false;
  await recordEvent(redis, fields);
  if (fields.name) await rememberName(redis, fields.email, fields.name);
  return true;
}
