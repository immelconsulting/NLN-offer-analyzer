import { getRedis, getSubmission } from "./_lib/store.js";
import { rejectIfOverLimit } from "./_lib/rateLimit.js";
import { isAuthorized, safeEqual } from "./_lib/auth.js";
import { FLOW_IDS, linkVisitor, recordEvent, isVisitorId } from "./_lib/events.js";
import { deliverResults, requestResultsByRef, isRequestRef } from "./_lib/resultsEmail.js";

// POST: "Email me my results" (wait screen or results page). Email is optional
// across the site, so this is the one place it's collected before checkout. It
// also keeps the leads list the CSV export reads.
// GET ?id=&t=: loads an emailed results link (/r/<id>?t=<token>).

const LEADS_KEY = "nln:leads";
const FLOW_STAGES = {
  offer: "Received an offer",
  apply: "Applying",
  interview: "Interviewing",
  offer_soon: "Expecting an offer soon",
};

async function handleGet(req, res, redis) {
  const { id, t } = req.query || {};
  const record = id && t ? await getSubmission(redis, String(id)) : null;
  if (!record?.resultsToken || !safeEqual(String(t), record.resultsToken)) {
    return res.status(404).json({ error: "We couldn't find those results." });
  }
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    flow: record.flow || "offer",
    form: record.form,
    analysis: { ...record.analysis, submissionId: record.id },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const redis = getRedis();
  if (!redis) return res.status(500).json({ error: "Storage is not configured." });

  if (req.method === "GET") {
    try {
      return await handleGet(req, res, redis);
    } catch (err) {
      console.error("Results link failed:", err);
      return res.status(502).json({ error: "We couldn't load those results." });
    }
  }

  const { email, marketingOptIn, requestRef, submissionId, flow, vid } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }
  if (await rejectIfOverLimit(req, res, "lead")) return;

  const clean = String(email).trim().toLowerCase();
  const cleanFlow = FLOW_IDS.includes(flow) ? flow : undefined;
  try {
    await redis.rpush(
      LEADS_KEY,
      JSON.stringify({
        email: clean,
        stage: FLOW_STAGES[cleanFlow] || "",
        marketingOptIn: marketingOptIn === true,
        timestamp: new Date().toISOString(),
      })
    );
    await linkVisitor(redis, vid, clean);
    await recordEvent(redis, {
      e: "lead_captured",
      email: clean,
      vid: isVisitorId(vid) ? vid : undefined,
      flow: cleanFlow,
      internal: isAuthorized(req) ? true : undefined,
    });
    if (typeof submissionId === "string" && submissionId) await deliverResults(redis, submissionId, clean);
    else if (isRequestRef(requestRef)) await requestResultsByRef(redis, requestRef, clean);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Results email failed:", err);
    return res.status(502).json({ error: "We couldn't send that just now. Please try again." });
  }
}
