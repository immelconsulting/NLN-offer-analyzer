import { getRedis, getSubmission } from "./_lib/store.js";
import { verifyPayment } from "./_lib/payment.js";
import { PRE_OFFER_FLOWS } from "./_lib/scriptMessages.js";
import {
  readSavedScript,
  readRunningJob,
  startScriptJob,
  writeScriptNow,
  previewStatus,
  subtitleFor,
  canRunAgain,
  allowRetry,
  isTestJobId,
  FAILED_MESSAGE,
} from "./_lib/scriptJob.js";

export { applyFloors, recruiterRangeCheck, wideRangeAnswer } from "./_lib/scriptMessages.js";

// The $47 script, in two parts (api/_lib/scriptJob.js does the work):
//
// { preview: true, submissionId }: the free opening shown on the offer page.
// Written once per analysis. No payment needed, but it only ever runs on a
// saved analysis, so nobody can spend model calls on arbitrary input.
//
// { sessionId, ... }: the paid script. The client sends the Stripe Checkout
// session id from the Payment Link redirect; we confirm it's paid, then start
// a background job and answer straight away. The page asks again every few
// seconds, so a refresh, a closed tab or a phone switching apps can't lose
// anything: the job carries on either way, and the same link picks it back up.
//
// One payment = one script. The first script for a checkout session is kept
// under nln:script:<session id>, and every later request for that session (a
// reload, another device, the link in the buyer's email) gets that same script
// back, without the offer data and without a new model call.

function generating(job) {
  return { status: "generating", preview: job.preview || null, flow: job.flow, subtitle: job.subtitle };
}

function ready(saved, { waited }) {
  return {
    status: "ready",
    script: saved.script,
    flow: saved.flow,
    subtitle: saved.subtitle,
    // Only someone who just waited for it is told where it went; this link
    // may be opened later, and needn't show their address.
    emailedTo: waited ? saved.emailTo || null : undefined,
    reopened: waited ? undefined : true,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server is misconfigured (missing API key)." });
  }

  const redis = getRedis();
  const { sessionId, vid, waited, retry, preview: wantsPreview, submissionId } = req.body || {};
  let { form, analysis, flow: rawFlow } = req.body || {};

  if (wantsPreview) {
    try {
      return res.status(200).json(await previewStatus(redis, apiKey, submissionId));
    } catch (err) {
      // The offer page just carries on without a preview.
      console.error("Script preview failed:", err);
      return res.status(200).json({ status: "none" });
    }
  }

  if (!sessionId) {
    return res.status(400).json({ error: "Missing payment session." });
  }

  // Saved or already being written: no need to ask Stripe again on every poll.
  const isRealPayment = sessionId !== "test_skip_payment";
  if (isRealPayment && redis) {
    try {
      const saved = await readSavedScript(redis, sessionId);
      if (saved) return res.status(200).json(ready(saved, { waited }));
      const job = await readRunningJob(redis, sessionId);
      if (job) return res.status(200).json(generating(job));
    } catch (err) {
      console.error("Saved script lookup failed:", err);
    }
  }

  const payment = await verifyPayment(sessionId);
  if (!payment.paid) {
    return res.status(payment.status).json({ error: payment.error });
  }

  // The proof page stamps the analysis id on the Stripe link as
  // client_reference_id, so the payment itself says which analysis it was
  // for. That record wins over whatever this browser stashed: it works on a
  // different device or browser, and can't be confused by a second analysis
  // run in another tab before paying.
  const reference = payment.session?.client_reference_id;
  if (reference && redis) {
    try {
      const record = await getSubmission(redis, reference);
      if (record?.form && record?.analysis) {
        form = record.form;
        analysis = { ...record.analysis, submissionId: record.id };
        rawFlow = record.flow || "offer"; // offer records predate the field
      }
    } catch (err) {
      console.error("Payment's analysis lookup failed; using the browser's copy:", err);
    }
  }

  const flow = PRE_OFFER_FLOWS.includes(rawFlow) ? rawFlow : "offer";
  const isPreOffer = flow !== "offer";

  if (!form || !analysis) {
    // Opened somewhere without the offer details, and the payment carries no
    // usable reference (e.g. paid before references existed).
    return res.status(404).json({
      error:
        "We couldn't find a script for this payment yet. Open this link in the browser you used to analyze your offer, or email us and we'll sort it out.",
    });
  }
  if (isPreOffer) {
    if (!form.targetRole || !form.location) {
      return res.status(400).json({ error: "Missing candidate details." });
    }
    // The offer-soon flow researches company-specific pay, so the company is
    // required there but optional on the screening-call forms.
    if (flow === "offer_soon" && !form.targetCompany) {
      return res.status(400).json({ error: "Missing candidate details." });
    }
  } else if (!form.role || !form.location || !form.offerBaseSalary) {
    return res.status(400).json({ error: "Missing offer details." });
  }

  const context = { apiKey, flow, form, analysis, session: payment.session, vid };

  // The shared test id is used by everyone, so a test run is kept per analysis
  // (briefly, never emailed), and only when there is an analysis to key it on.
  const jobId = isRealPayment
    ? sessionId
    : analysis.submissionId
      ? `test-${analysis.submissionId}`
      : null;

  if (redis && jobId) {
    try {
      if (isTestJobId(jobId)) {
        const saved = await readSavedScript(redis, jobId);
        if (saved) return res.status(200).json(ready(saved, { waited: true }));
        const job = await readRunningJob(redis, jobId);
        if (job) return res.status(200).json(generating(job));
      }
      if (retry) await allowRetry(redis, jobId);
      if (!(await canRunAgain(redis, jobId))) {
        return res.status(200).json({ status: "failed", error: FAILED_MESSAGE, flow, subtitle: subtitleFor(flow, form) });
      }
      const job = await startScriptJob(redis, jobId, context);
      return res.status(200).json(generating(job || (await readRunningJob(redis, jobId)) || { flow, subtitle: subtitleFor(flow, form) }));
    } catch (err) {
      // Storage trouble: write it right here instead, as the page always did.
      console.error("Couldn't start the script job; writing it directly:", err);
    }
  }

  try {
    const saved = await writeScriptNow(redis, isRealPayment ? sessionId : null, context);
    return res.status(200).json({ status: "ready", script: saved.script, flow, subtitle: saved.subtitle, emailedTo: saved.emailTo || null });
  } catch (err) {
    console.error("Script generation failed:", err);
    return res.status(502).json({
      error: "We couldn't generate your script right now. Please try again.",
    });
  }
}
