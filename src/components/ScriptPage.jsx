import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { decodeResult } from "../lib/encodeResult.js";
import { isKnownFlow, usesTargetFields } from "../lib/flows.js";
import SiteHeader from "./SiteHeader.jsx";
import MeetJennyLink from "./MeetJennyLink.jsx";
import ScriptMarkdown from "./ScriptMarkdown.jsx";
import { curlyQuotes } from "../lib/readableText.js";
import icon from "../assets/nln-icon.png";
import { CONTACT_EMAIL } from "../lib/config.js";
import { track, getVisitorId } from "../lib/track.js";
import { buildScriptPdf, scriptPdfFilename } from "../lib/scriptPdf.js";

// Post-payment destination. Stripe's Payment Link redirects here with
// ?session_id={CHECKOUT_SESSION_ID}; the offer data was stashed in
// localStorage by the results page before checkout. The server keeps the
// first script written for each payment, so this same link (it's also in the
// buyer's email) reopens that script on any device, without the stash.
//
// The server writes the script as a background job, and this page just keeps
// asking how it's going. So a refresh, a closed tab or a phone switching apps
// loses nothing: coming back picks up wherever the job has got to.

const CHECK_EVERY_MS = 4000;
const SLOW_AFTER_MS = 3 * 60 * 1000;
const MISSED_CHECKS_ALLOWED = 8;

const FLOW_COPY = {
  offer: {
    title: "Your Counter-Offer Script",
    loading: "Writing your script…",
    loadingNote:
      "We're turning your analysis into a word-for-word counter-offer script. This usually takes under a minute.",
    upsellHeading: "Want Jenny Foss to help you prepare?",
    upsellBody:
      "Book a Negotiation Strategy Session with Jenny Foss and walk through your script together before you pick up the phone.",
  },
  // Applying and Interviewing buy the same screening-call script.
  apply: {
    title: "Your Recruiter Screening Call Script",
    loading: "Writing your script…",
    loadingNote:
      "We're turning your range into word-for-word answers for the recruiter call. This usually takes under a minute.",
    upsellHeading: "Want Jenny Foss to help you prepare?",
    upsellBody:
      "Book a Negotiation Strategy Session with Jenny Foss and practice your answers together before the recruiter calls.",
  },
  offer_soon: {
    title: "Your Offer Call Script",
    loading: "Writing your script…",
    loadingNote:
      "We're turning your range into word-for-word lines for the offer call. This usually takes under a minute.",
    upsellHeading: "Want Jenny Foss to help you prepare?",
    upsellBody:
      "Book a Negotiation Strategy Session with Jenny Foss and rehearse the offer call together before your recruiter reaches out.",
  },
};

// Interviewing buys the identical screening-call script.
FLOW_COPY.interview = FLOW_COPY.apply;

// pdfmake is large, so it's only fetched once a script is on screen (the
// page starts the fetch then, so the button is quick when clicked).
let pdfMakePromise = null;
const loadPdfMake = () =>
  (pdfMakePromise ||= Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]).then(
    ([pdfMakeModule, fontsModule]) => {
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      pdfMake.addVirtualFileSystem(fontsModule.default || fontsModule);
      return pdfMake;
    }
  ).catch((err) => {
    pdfMakePromise = null; // let the next click retry
    throw err;
  }));

// Rendered both above and below the script. Builds a real PDF file once,
// saves it (a plain download link) and shows the same file in a new tab.
// The tab has to be opened synchronously in the click, or pop-up blockers
// stop it, so it's opened first and pointed at the PDF when it's ready.
// It never opens the print dialog on its own: if the PDF can't be built on
// this device, it says so, offers printing as an explicit choice, and
// reports the error so we can see what failed.
function DownloadPdfButton({ script, title, subtitle }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleClick() {
    track("script_pdf_downloaded");
    const tab = window.open("", "_blank");
    try {
      if (tab) {
        tab.document.title = "Preparing your PDF…";
        tab.document.body.innerHTML =
          '<p style="font-family:sans-serif;padding:2rem;color:#334155">Preparing your PDF…</p>';
      }
    } catch {
      // Cosmetic only; the PDF still goes into this tab below.
    }
    setBusy(true);
    setFailed(false);
    try {
      const pdfMake = await loadPdfMake();
      const blob = await pdfMake.createPdf(buildScriptPdf({ script, title, subtitle })).getBlob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = scriptPdfFilename(title);
      document.body.appendChild(link);
      link.click();
      link.remove();

      if (tab && !tab.closed) tab.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      console.error("PDF generation failed:", err);
      try {
        tab?.close();
      } catch {
        // already gone
      }
      track("script_pdf_failed", { message: String(err?.message || err).slice(0, 200) });
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-md bg-navy-900 hover:bg-navy-600 disabled:opacity-60 text-white font-semibold px-5 py-2.5 shadow-sm transition"
      >
        {busy ? "Preparing PDF…" : "⤓ Download PDF"}
      </button>
      {failed && (
        <p className="text-xs text-rose-700 max-w-xs text-center">
          We couldn&rsquo;t build the PDF on this device.{" "}
          <button type="button" onClick={() => window.print()} className="underline">
            Print or save as PDF instead
          </button>
        </p>
      )}
    </div>
  );
}

export default function ScriptPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const data = useMemo(() => {
    try {
      const encoded = localStorage.getItem("nln:pendingScript");
      return encoded ? decodeResult(encoded) : null;
    } catch {
      return null;
    }
  }, []);

  // Which funnel produced this purchase. Offer-flow stashes predate the
  // field and decode without it, so anything unrecognized is an offer.
  const flow = isKnownFlow(data?.flow) ? data.flow : "offer";

  const [script, setScript] = useState("");
  const [saved, setSaved] = useState(null); // { flow, subtitle, emailedTo } from the server
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState(""); // the opening they already saw
  const [slow, setSlow] = useState(false);

  // A script reopened from another device knows its flow only from the server.
  const shownFlow = isKnownFlow(saved?.flow) ? saved.flow : flow;
  const isPreOffer = usesTargetFields(shownFlow);
  const copy = FLOW_COPY[shownFlow] || FLOW_COPY.offer;
  const subtitle =
    saved?.subtitle ||
    (data?.form
      ? `${isPreOffer ? data.form.targetRole : data.form.role}${
          (isPreOffer ? data.form.targetCompany : data.form.company)
            ? ` at ${isPreOffer ? data.form.targetCompany : data.form.company}`
            : ""
        } · ${data.form.location}`
      : "");

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    let timer;
    let waited = false;
    let missed = 0;
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);

    function checkAgainSoon(ms = CHECK_EVERY_MS) {
      clearTimeout(timer);
      timer = setTimeout(check, ms);
    }

    async function check() {
      setError("");
      try {
        const res = await fetch("/api/generate-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            flow,
            form: data?.form,
            analysis: data?.analysis,
            vid: getVisitorId(),
            waited,
            retry: attempt > 0 && !waited,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          throw new Error(body.error || "Something went wrong generating your script.");
        }
        missed = 0;
        if (body.script) {
          setScript(body.script);
          setSaved({ flow: body.flow, subtitle: body.subtitle, emailedTo: body.emailedTo });
          setLoading(false);
          // Reopening a saved script isn't a new delivery for the funnel.
          if (!body.reopened) track("script_generated");
        } else if (body.status === "failed") {
          setSaved({ flow: body.flow, subtitle: body.subtitle });
          setError(body.error);
          setLoading(false);
        } else {
          waited = true;
          setSaved({ flow: body.flow, subtitle: body.subtitle });
          if (body.preview) setPreview(body.preview);
          checkAgainSoon();
        }
      } catch (err) {
        if (cancelled) return;
        // Mid-wait, a dropped connection is normal on a phone: the job is
        // still running, so keep asking. Only give up after a good while.
        missed += 1;
        if (waited && missed <= MISSED_CHECKS_ALLOWED) {
          checkAgainSoon(CHECK_EVERY_MS * 2);
        } else {
          setError(err.message || "Something went wrong. Please try again.");
          setLoading(false);
        }
      }
    }

    // Back from another app: don't make them wait for the next timer.
    function onVisible() {
      if (document.visibilityState === "visible" && waited) checkAgainSoon(0);
    }
    document.addEventListener("visibilitychange", onVisible);

    setLoading(true);
    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(slowTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sessionId, data, attempt, flow]);

  useEffect(() => {
    if (script) loadPdfMake().catch(() => {});
  }, [script]);

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <header className="print:hidden">
        <div className="max-w-3xl mx-auto px-6 pt-10 pb-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-navy-950">
            {copy.title}
          </h1>
          {subtitle && <p className="text-slate-700 mt-4">{subtitle}</p>}
          <p className="text-sm text-slate-600 mt-2">
            Built from Alex Immel’s negotiation playbook and tailored to your role, your market and your situation.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {(!sessionId || notFound) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-lg font-medium text-navy-900 mb-2">
              We couldn't find your offer details.
            </p>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              {!sessionId
                ? "This page needs to be reached through the payment confirmation link."
                : "Your script is written in the same browser you used to analyze your offer. Open this link there, or contact us and we'll make it right."}
            </p>
            <Link
              to="/"
              className="inline-block bg-navy-900 hover:bg-navy-600 text-white rounded-md px-5 py-2.5 font-medium transition"
            >
              Back to Home
            </Link>
          </div>
        )}

        {loading && preview && (
          <>
            <div className="bg-navy-900 text-white rounded-xl p-5 flex items-center gap-4" role="status">
              <div className="shrink-0 h-8 w-8 rounded-full border-4 border-navy-600 border-t-white animate-spin" />
              <div>
                <p className="font-semibold">Finishing your script, about a minute</p>
                <p className="text-sm text-navy-100 mt-0.5">
                  {slow
                    ? "This is taking longer than usual. We'll email it to you as soon as it's ready."
                    : "It's safe to close this page. We'll email it to you too."}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
              <ScriptMarkdown spokenBlocks>{curlyQuotes(preview)}</ScriptMarkdown>
            </div>
          </>
        )}

        {loading && !preview && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex flex-col items-center text-center">
            <img src={icon} alt="NLN" className="h-12 w-auto animate-pulse mb-6" />
            <div className="h-10 w-10 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin mb-6" />
            <p className="text-xl font-serif font-semibold text-navy-900">
              {copy.loading}
            </p>
            <p className="text-slate-600 text-sm mt-2 max-w-xs">
              {slow
                ? "This is taking longer than usual. We'll email it to you as soon as it's ready."
                : `${copy.loadingNote} It's safe to close this page. We'll email it to you too.`}
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 mb-6">
              {error}
            </div>
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="bg-navy-900 hover:bg-navy-600 text-white rounded-md px-6 py-3 font-medium transition"
            >
              Try Again
            </button>
          </div>
        )}

        {script && !loading && (
          <>
            {/* Also offered above the script: these run long, and someone who
                wants the PDF shouldn't have to scroll the whole thing first. */}
            <div className="flex flex-wrap items-center justify-between gap-3 -mb-4 print:hidden">
              <p className="text-sm text-slate-600">
                {saved?.emailedTo
                  ? `A copy is on its way to ${saved.emailedTo}.`
                  : "Bookmark this page to come back to your script any time."}
              </p>
              <DownloadPdfButton script={script} title={copy.title} subtitle={subtitle} />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 print:border-0 print:shadow-none print:p-0">
              <ScriptMarkdown spokenBlocks>{curlyQuotes(script)}</ScriptMarkdown>
            </div>
            <div className="text-center print:hidden">
              <DownloadPdfButton script={script} title={copy.title} subtitle={subtitle} />
            </div>
            <p className="text-center text-sm text-slate-500 print:text-left print:mt-4">
              This script was generated by AI based on NLN's methodology and
              the details you provided. It's meant as general guidance, not
              personalized legal, financial, or professional advice, and
              outcomes aren't guaranteed.
            </p>

            <div className="bg-navy-950 text-white rounded-xl p-6 sm:p-8 text-center print:hidden">
              <h2 className="text-lg font-serif font-semibold">
                {copy.upsellHeading}
              </h2>
              <p className="text-navy-200 text-sm mt-2 max-w-md mx-auto">
                {copy.upsellBody}
              </p>
              <Link
                to="/session"
                className="inline-block mt-5 bg-white text-navy-900 hover:bg-navy-50 font-medium rounded-md px-6 py-3 transition"
              >
                Learn About Strategy Sessions
              </Link>
              <p className="mt-3 text-sm">
                <MeetJennyLink className="text-navy-100 hover:text-white" />
              </p>
            </div>
          </>
        )}

        {script && !loading && (
          <p className="text-center text-sm text-slate-500 print:hidden">
            How did your negotiation go? I read every reply. Email me at{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("How my negotiation went")}`}
              className="font-medium text-navy-600 hover:text-navy-900 transition"
            >
              {CONTACT_EMAIL}
            </a>{" "}
            and tell me how it went, or share feedback on your script.
          </p>
        )}

        <p className="text-center text-sm text-slate-500 print:hidden">
          Trouble with your script or payment? Reach out at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-navy-600 hover:text-navy-900 transition"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </main>
    </div>
  );
}
