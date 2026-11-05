import Anthropic from "@anthropic-ai/sdk";
import { waitUntil } from "@vercel/functions";
import { getSubmission, updateSubmission, attachEmail } from "./store.js";
import { sendEmail, sendScriptEmail } from "./email.js";
import { promoCodeUsed } from "./payment.js";
import { cleanForCustomers, ONE_LINE_CASE_HEADER } from "./text.js";
import { isVisitorId, recordPurchaseOnce } from "./events.js";
import { buildScriptMessage, loadSystemPrompt, SCREENING_FLOWS } from "./scriptMessages.js";
import { CONTACT_EMAIL, STRATEGY_SESSION_URL } from "../../src/lib/config.js";

// Writing the $47 script, in two parts: a free opening before payment, the rest
// after. The paid part runs as a background job so it can't depend on the
// buyer's browser staying open:
//
//   nln:script:<session id>       the finished script (what every reader gets)
//   nln:script-job:<session id>   "being written right now", with what the
//                                 page needs to show meanwhile; expires by
//                                 itself if the function dies mid-write
//   nln:script-runs:<session id>  how many runs have been tried
//
// Anything can start the job (the script page, or Stripe's webhook for someone
// who never came back); the job key means only one runs at a time. If a run
// fails it retries once, then emails Alex, and the page's next check starts
// another run, up to MAX_RUNS.

const MODEL = "claude-sonnet-4-6";
const SITE_URL = new URL(STRATEGY_SESSION_URL).origin;
const SCRIPT_TTL_SECONDS = 60 * 60 * 24 * 365 * 2;
const TEST_TTL_SECONDS = 60 * 60;
const PREVIEW_TTL_SECONDS = 60 * 60 * 24 * 365;

// A run is two tries of at most 130s, inside the function's 300s limit, so a
// slow model still reaches the alert. The job key outlives the function.
const MODEL_TIMEOUT_MS = 130_000;
const PREVIEW_TIMEOUT_MS = 60_000;
const TRIES_PER_RUN = 2;
const JOB_SECONDS = 310;
const MAX_RUNS = 3;

const scriptKey = (id) => `nln:script:${id}`;
const jobKey = (id) => `nln:script-job:${id}`;
const runsKey = (id) => `nln:script-runs:${id}`;
const alertKey = (id) => `nln:script-alerted:${id}`;
// v4: older openings carry wording that's since changed ("walk-away floor"),
// and the rest of the script is written to follow on from the opening.
const previewKey = (id) => `nln:preview:v4:${id}`;
const previewLockKey = (id) => `nln:preview-lock:${id}`;

export const isTestJobId = (id) => id.startsWith("test-");
const isScreening = (flow) => SCREENING_FLOWS.includes(flow);

export const FAILED_MESSAGE =
  "Your payment is safe, and we've been alerted. We're having trouble writing your script right now, and we'll email it to you as soon as it's ready. You can also try again here.";

// Same titles the script page shows, used for the emailed copy.
const SCRIPT_TITLES = {
  offer: "Your Counter-Offer Script",
  apply: "Your Recruiter Screening Call Script",
  interview: "Your Recruiter Screening Call Script",
  offer_soon: "Your Offer Call Script",
};

// Shown under the preview so people can see the whole structure. Written here rather than asked of the model, so
// the preview stays one short call.
export function remainingHeadings(flow, form = {}) {
  if (flow === "offer") {
    return [
      "Clearing up open questions",
      ONE_LINE_CASE_HEADER,
      "Delivering your counter",
      "Handling objections",
      "Closing",
      "Follow-up note",
      "Sign-off",
    ];
  }
  if (flow === "offer_soon") {
    return [
      "If the recruiter asks for your expectations first",
      "When the recruiter shares an offer",
      "If they ask for your expectations again",
      "If they ask for your current salary",
      "Handling pushback on your timeline",
      "If a lower number works for you",
      ...(["i_shared_number", "both_shared"].includes(form.compStatus) ? ["If you already shared a number"] : []),
      "Closing the call",
      "Sign-off",
    ];
  }
  return [
    ...(form.salaryStage === "told_number" ? ["How to respond to the number they told you"] : []),
    "Your word-for-word answers to the salary question",
    "If the recruiter shares a range",
    "When they insist on a number",
    "If they ask for your current salary",
    "If a lower number works for you",
    ...(form.salaryStage === "gave_number" ? ["If you already gave a number"] : []),
    "If money already came up",
    "Questions to ask before the call ends",
    "Sign-off",
  ];
}

export function previewInstruction(flow) {
  const stop = isScreening(flow)
    ? 'stop immediately after the line that asks "What are your salary expectations?". Do not write any answer to it, or any line marked 🗣️. If the script would reach a line marked 🗣️ before that question, stop just before that line instead.'
    : "stop immediately after the first line marked 🗣️ (including the question or setup just before it).";
  return `\n\nPREVIEW ONLY: for now, write only the beginning of this script, in order from the top, and ${stop} Write everything exactly as it would appear in the full script, with the same markdown headers and any label on that line, such as Option A. Write nothing after that: no other options, no notes, no later sections, no sign-off, and no note saying more is coming.`;
}

export function restInstruction(opening) {
  return `\n\nTHE OPENING IS ALREADY WRITTEN. The customer has read this opening word for word, and it will sit directly above what you write:\n\n<opening>\n${opening}\n</opening>\n\nContinue from exactly where it stops and write everything that comes after it, following the structure above. If it stops partway through a section, carry on with that section without repeating its header. Do not repeat, reword, or contradict the opening, do not introduce Alex again, and use the same numbers it uses. Start directly with whatever comes next.`;
}

// Where the free part stops, whatever the model wrote past it, so it can't give
// away more of the paid script than intended. Most scripts stop at their first
// spoken line. On the screening script that line is the whole point of buying
// it, so it stops at the question and never shows an answer. Null if there's
// nothing to cut at.
export function cutPreview(text, flow) {
  const lines = text.split("\n");
  const spoken = lines.findIndex((line) => line.includes("🗣"));
  const upTo = (end) => lines.slice(0, end).join("\n").trim();
  if (!isScreening(flow)) return spoken === -1 ? null : upTo(spoken + 1);

  const question = lines.findIndex((line) => /\bQ:.*salary expectations/i.test(line));
  if (question !== -1 && (spoken === -1 || question < spoken)) return upTo(question + 1);
  if (spoken === -1) return null;
  // No question first (they were told the number): stop short of the response,
  // along with any bare label like "Option A:" left waiting for it.
  return upTo(spoken).replace(/\n+\s*\**(?:Option [AB]|Response)\b[^\n]*$/i, "").trim();
}

// Puts the opening and the rest together. Drops a repeated first heading, the
// one way the model has been known to restart.
export function joinScript(opening, rest) {
  const firstLine = (text) => text.trim().split("\n")[0].trim();
  let body = rest.trim();
  if (firstLine(body) === firstLine(opening)) body = body.split("\n").slice(1).join("\n").trim();
  return `${opening.trim()}\n\n${body}`;
}

export function subtitleFor(flow, form) {
  const isPreOffer = flow !== "offer";
  const role = isPreOffer ? form.targetRole : form.role;
  const company = isPreOffer ? form.targetCompany : form.company;
  return `${role}${company ? ` at ${company}` : ""} · ${form.location}`;
}

async function callModel(apiKey, { system, message, maxTokens, timeout, label }) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create(
    { model: MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: message }] },
    { timeout, maxRetries: 0 }
  );
  // Logged so the real cost per preview and per script can be read off Vercel.
  console.log(`Script model usage (${label}):`, JSON.stringify(response.usage || {}));
  const text = cleanForCustomers(
    response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim()
  );
  if (!text) throw new Error("Empty script response from model.");
  return { text, stopReason: response.stop_reason };
}

// ---------- The free preview ----------

async function writePreview(redis, apiKey, record) {
  const id = record.id;
  try {
    const flow = record.flow || "offer";
    const analysis = { ...record.analysis, submissionId: id };
    const message = await buildScriptMessage(redis, flow, record.form, analysis);
    const { text, stopReason } = await callModel(apiKey, {
      system: loadSystemPrompt(flow),
      message: message + previewInstruction(flow),
      maxTokens: 2000,
      timeout: PREVIEW_TIMEOUT_MS,
      label: "preview",
    });
    const preview = cutPreview(text, flow);
    // Cut off before reaching a spoken line, it isn't fit to show or build on.
    if (!preview && stopReason === "max_tokens") throw new Error("Preview ran too long.");
    await redis.set(previewKey(id), { text: preview || text, createdAt: new Date().toISOString() }, { ex: PREVIEW_TTL_SECONDS });
  } catch (err) {
    // Stops the page reloading its way into more model calls for a while.
    console.error("Writing the script preview failed:", err);
    await redis.set(previewKey(id), { failed: true }, { ex: 60 * 60 }).catch(() => {});
  } finally {
    await redis.del(previewLockKey(id)).catch(() => {});
  }
}

// { status: "ready", preview, headings, flow } | { status: "generating" } | { status: "none" }
export async function previewStatus(redis, apiKey, submissionId) {
  if (!redis || typeof submissionId !== "string" || !submissionId) return { status: "none" };

  const stored = await redis.get(previewKey(submissionId));
  const record = stored?.failed ? null : await getSubmission(redis, submissionId);
  if (stored?.failed || !record?.form || !record?.analysis) return { status: "none" };

  const flow = record.flow || "offer";
  if (stored?.text) {
    return { status: "ready", preview: stored.text, headings: remainingHeadings(flow, record.form), flow };
  }
  const first = await redis.set(previewLockKey(submissionId), 1, { nx: true, ex: 90 });
  if (first) waitUntil(writePreview(redis, apiKey, record));
  return { status: "generating" };
}

async function readPreviewText(redis, submissionId) {
  if (!submissionId) return null;
  try {
    return (await redis.get(previewKey(submissionId)))?.text || null;
  } catch {
    return null; // Then the whole script gets written in one go, as before.
  }
}

// ---------- The paid script ----------

export async function readSavedScript(redis, id) {
  const saved = await redis.get(scriptKey(id));
  return saved?.script ? { ...saved, script: cleanForCustomers(saved.script) } : null;
}

export const readRunningJob = (redis, id) => redis.get(jobKey(id));

export async function canRunAgain(redis, id) {
  return Number((await redis.get(runsKey(id))) || 0) < MAX_RUNS;
}

// The "Try again" button: one more go after the automatic ones ran out.
export async function allowRetry(redis, id) {
  await redis.del(runsKey(id));
}

async function writeFullScript(redis, { apiKey, flow, form, analysis }, opening) {
  const message = await buildScriptMessage(redis, flow, form, analysis);
  const { text } = await callModel(apiKey, {
    system: loadSystemPrompt(flow),
    message: opening ? message + restInstruction(opening) : message,
    maxTokens: 8192,
    timeout: MODEL_TIMEOUT_MS,
    label: opening ? "rest of script" : "full script",
  });
  return opening ? joinScript(opening, text) : text;
}

async function alertAlex(redis, id, { session, analysis, flow }, problem) {
  // Once per payment, however many runs fail.
  if (!(await redis.set(alertKey(id), 1, { nx: true, ex: 60 * 60 * 24 * 30 }))) return;
  const buyer = session?.customer_details?.email || "unknown";
  await sendEmail({
    from: process.env.SCRIPT_EMAIL_FROM || "Next Level Negotiation <scripts@nextlevelnegotiation.com>",
    to: [CONTACT_EMAIL],
    subject: `Action needed: a paid script had a problem (${buyer})`,
    text: [
      problem,
      "",
      `Buyer: ${buyer}`,
      `Flow: ${flow}`,
      `Analysis: ${analysis?.submissionId || "none"}`,
      `Script link for the buyer: ${SITE_URL}/script?session_id=${encodeURIComponent(id)}`,
      "",
      "The site keeps retrying while the buyer has that page open. If they have no script within the hour, opening that link yourself retries it too.",
    ].join("\n"),
  });
}

async function sendWithRetry(redis, id, context, saved) {
  const to = saved.emailTo;
  for (let tryNumber = 1; tryNumber <= 2; tryNumber += 1) {
    try {
      await sendScriptEmail({
        to,
        title: SCRIPT_TITLES[context.flow],
        script: saved.script,
        scriptUrl: `${SITE_URL}/script?session_id=${encodeURIComponent(id)}`,
      });
      return;
    } catch (err) {
      console.error(`Emailing the script failed (try ${tryNumber}):`, err);
    }
  }
  // They may have closed the page and be counting on this email.
  await alertAlex(redis, id, context, "The script was written and saved, but emailing it to the buyer failed. Please send them the link below.").catch(
    (err) => console.error("Alerting Alex failed:", err)
  );
}

// Saves the script, then does everything a first-time delivery involves.
async function saveAndDeliver(redis, id, context, script) {
  const { session, analysis, flow, form, vid } = context;
  const test = isTestJobId(id);
  const buyerEmail = test ? null : session?.customer_details?.email;
  const saved = {
    script,
    flow,
    subtitle: subtitleFor(flow, form),
    emailTo: buyerEmail || undefined,
    createdAt: new Date().toISOString(),
  };
  // NX: if two writers ever raced, the first saved script wins and is the one
  // everyone sees from now on.
  const first = await redis.set(scriptKey(id), saved, {
    nx: true,
    ex: test ? TEST_TTL_SECONDS : SCRIPT_TTL_SECONDS,
  });
  if (!first) return (await readSavedScript(redis, id)) || saved;
  if (test) return saved;

  try {
    // The dashboard's "Bought a script" step. Tied to the email they used in
    // the tool when there is one, so it lands on the same person as their
    // visits; recorded before the email so a Resend failure can't hide a sale.
    const submission = analysis.submissionId
      ? await attachEmail(redis, analysis.submissionId, buyerEmail).catch(() => null)
      : null;
    await recordPurchaseOnce(redis, id, {
      e: "script_purchased",
      email: (submission?.email || buyerEmail || "").toLowerCase() || undefined,
      // The visitor who ran the analysis, even if they paid on another device.
      vid: submission?.vid || (isVisitorId(vid) ? vid : undefined),
      flow,
      amount: session?.amount_total ?? undefined,
      promo: await promoCodeUsed(session),
      name: session?.customer_details?.name || undefined,
    });
  } catch (err) {
    console.error("Recording the script sale failed:", err);
  }
  if (buyerEmail) await sendWithRetry(redis, id, context, saved);
  if (analysis.submissionId) {
    await updateSubmission(redis, analysis.submissionId, {
      script,
      scriptGeneratedAt: new Date().toISOString(),
    }).catch((err) => console.error("Failed to attach script to submission:", err));
  }
  return saved;
}

async function runJob(redis, id, context, opening) {
  try {
    let script = null;
    let lastError = null;
    for (let tryNumber = 1; tryNumber <= TRIES_PER_RUN && !script; tryNumber += 1) {
      try {
        script = await writeFullScript(redis, context, opening);
      } catch (err) {
        lastError = err;
        console.error(`Writing the script failed (try ${tryNumber}):`, err);
      }
    }
    if (script) {
      await saveAndDeliver(redis, id, context, script);
    } else if (!isTestJobId(id)) {
      await alertAlex(
        redis,
        id,
        context,
        `A buyer paid, and writing their script failed twice: ${lastError?.message || "unknown error"}.`
      );
    }
  } catch (err) {
    console.error("Script job failed:", err);
  } finally {
    await redis.del(jobKey(id)).catch(() => {});
  }
}

// Starts the job unless one is already running. Returns what the page should
// show while it runs, or null if another one got there first.
export async function startScriptJob(redis, id, context) {
  const opening = await readPreviewText(redis, context.analysis.submissionId);
  const job = { preview: opening, flow: context.flow, subtitle: subtitleFor(context.flow, context.form) };
  const first = await redis.set(jobKey(id), job, { nx: true, ex: JOB_SECONDS });
  if (!first) return null;
  await redis.incr(runsKey(id));
  await redis.expire(runsKey(id), 60 * 60 * 24);
  waitUntil(runJob(redis, id, context, opening));
  return job;
}

// For when there's no storage to run a job against, or it just failed: writes
// the script inside this request, as the page always used to.
export async function writeScriptNow(redis, id, context) {
  const script = await writeFullScript(redis, context, null);
  if (redis && id) {
    try {
      return await saveAndDeliver(redis, id, context, script);
    } catch (err) {
      console.error("Saving the script failed:", err);
    }
  }
  return { script, flow: context.flow, subtitle: subtitleFor(context.flow, context.form) };
}

// Stripe's webhook: starts the script for someone who paid but may never come
// back to the page. Only possible when the payment names its analysis.
export async function startScriptFromPayment(redis, session) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const reference = session?.client_reference_id;
  if (!redis || !apiKey || !reference) return false;
  if (await readSavedScript(redis, session.id)) return false;

  const record = await getSubmission(redis, reference);
  if (!record?.form || !record?.analysis) return false;
  if (!(await canRunAgain(redis, session.id))) return false;

  await startScriptJob(redis, session.id, {
    apiKey,
    flow: record.flow || "offer",
    form: record.form,
    analysis: { ...record.analysis, submissionId: record.id },
    session,
  });
  return true;
}
