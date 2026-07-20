import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { decodeResult } from "../lib/encodeResult.js";
import SiteHeader from "./SiteHeader.jsx";
import icon from "../assets/nln-icon.png";
import { CONTACT_EMAIL } from "../lib/config.js";

// Post-payment destination. Stripe's Payment Link redirects here with
// ?session_id={CHECKOUT_SESSION_ID}; the offer data was stashed in
// localStorage by the results page before checkout.

// Brand styling for the markdown-formatted script.
const markdownComponents = {
  h1: (props) => (
    <h1 className="text-2xl font-serif font-semibold text-navy-900 mt-8 mb-3 first:mt-0" {...props} />
  ),
  h2: (props) => (
    <h2 className="text-xl font-serif font-semibold text-navy-900 mt-8 mb-3 first:mt-0 border-b border-slate-200 pb-2" {...props} />
  ),
  h3: (props) => (
    <h3 className="text-lg font-serif font-semibold text-navy-900 mt-6 mb-2" {...props} />
  ),
  p: (props) => <p className="text-slate-800 leading-relaxed mb-4" {...props} />,
  ul: (props) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-800" {...props} />,
  ol: (props) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-800" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-navy-900" {...props} />,
  blockquote: (props) => (
    <blockquote className="border-l-4 border-navy-200 pl-4 italic text-slate-700 mb-4" {...props} />
  ),
  hr: () => <hr className="border-slate-200 my-6" />,
  table: (props) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border border-slate-200 rounded-lg" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-navy-50 text-navy-900" {...props} />,
  th: (props) => (
    <th className="text-left font-semibold px-4 py-2 border-b border-slate-200" {...props} />
  ),
  td: (props) => <td className="px-4 py-2 border-b border-slate-100" {...props} />,
};

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
      <SiteHeader />

      <header className="print:hidden">
        <div className="max-w-3xl mx-auto px-6 pt-10 pb-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-navy-950">
            Your Counter-Offer Script
          </h1>
          {data?.form && (
            <p className="text-slate-700 mt-4">
              {data.form.role}
              {data.form.company ? ` at ${data.form.company}` : ""} ·{" "}
              {data.form.location}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
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
          <>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 print:border-0 print:shadow-none print:p-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {script}
              </ReactMarkdown>
            </div>
            <div className="text-center print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-md border border-navy-700 text-navy-800 font-medium px-5 py-2.5 hover:bg-navy-50 transition"
              >
                ⤓ Download as PDF
              </button>
              <p className="text-xs text-slate-500 mt-2">
                Choose "Save as PDF" in the print dialog.
              </p>
            </div>
            <p className="text-center text-sm text-slate-500 print:text-left print:mt-4">
              This script was generated by AI based on NLN's methodology and
              the details you provided. It's meant as general guidance, not
              personalized legal, financial, or professional advice, and
              outcomes aren't guaranteed.
            </p>
          </>
        )}

        {script && !loading && (
          <p className="text-center text-sm text-slate-500 print:hidden">
            How did your negotiation go? I read every reply — email me at{" "}
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
