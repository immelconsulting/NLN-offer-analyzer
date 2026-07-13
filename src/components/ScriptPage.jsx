import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { decodeResult } from "../lib/encodeResult.js";
import wordmark from "../assets/nln-wordmark.png";
import icon from "../assets/nln-icon.png";
import { CONTACT_EMAIL } from "../lib/config.js";

// Post-payment destination. Stripe's Payment Link redirects here with
// ?session_id={CHECKOUT_SESSION_ID}; the offer data was stashed in
// localStorage by the results page before checkout.

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

  const [script, setScript] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!sessionId || !data) return;
    let cancelled = false;

    async function generate() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/generate-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            form: data.form,
            analysis: data.analysis,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || "Something went wrong generating your script.");
        }
        if (!cancelled) setScript(body.script);
      } catch (err) {
        if (!cancelled) setError(err.message || "Something went wrong. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    generate();
    return () => {
      cancelled = true;
    };
  }, [sessionId, data, attempt]);

  return (
    <div className="min-h-screen bg-navy-50">
      <div className="bg-white border-b border-navy-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link to="/">
            <img
              src={wordmark}
              alt="Next Level Negotiation"
              className="h-10 sm:h-12 w-auto"
            />
          </Link>
        </div>
      </div>

      <header className="bg-navy-950 text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold">
            Your Counter-Offer Script
          </h1>
          {data?.form && (
            <p className="text-navy-200 mt-3">
              {data.form.role}
              {data.form.company ? ` at ${data.form.company}` : ""} ·{" "}
              {data.form.location}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {(!sessionId || !data) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <p className="text-lg font-medium text-navy-900 mb-2">
              We couldn't find your offer details.
            </p>
            <p className="text-slate-600 max-w-md mx-auto mb-6">
              {!sessionId
                ? "This page needs to be reached through the payment confirmation link."
                : "Your script is generated in the same browser you used to analyze your offer. Re-open your results there, or contact us and we'll make it right."}
            </p>
            <Link
              to="/"
              className="inline-block bg-navy-900 hover:bg-navy-600 text-white rounded-md px-5 py-2.5 font-medium transition"
            >
              Back to Home
            </Link>
          </div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex flex-col items-center text-center">
            <img src={icon} alt="NLN" className="h-12 w-auto animate-pulse mb-6" />
            <div className="h-10 w-10 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin mb-6" />
            <p className="text-xl font-serif font-semibold text-navy-900">
              Writing your script…
            </p>
            <p className="text-slate-600 text-sm mt-2 max-w-xs">
              We're turning your analysis into a word-for-word counter-offer
              script. This usually takes under a minute.
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
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
              {script}
            </p>
          </div>
        )}

        <p className="text-center text-sm text-slate-500">
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
