import { useState } from "react";
import { Link } from "react-router-dom";
import { submitResultsEmail, wasEmailed } from "../lib/resultsEmail.js";

// The optional "Email me my results" offer: on the wait screen, and again on
// the results page for anyone who skipped it. Nothing here can affect the
// analysis or the buy buttons; a failure only shows a message in this box.

function EmailForm({ request, onSent, children }) {
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await submitResultsEmail({ ...request, email, marketingOptIn });
      onSent();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="text-left">
      <label htmlFor="results-email" className="sr-only">Your email address</label>
      <input
        id="results-email"
        type="email"
        autoComplete="email"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
      />
      <label className="flex items-start gap-2 mt-3 cursor-pointer">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-px h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
        />
        <span className="text-xs text-slate-500">
          Also send me occasional negotiation tips and resources
        </span>
      </label>
      {error && <p className="text-sm text-rose-700 mt-2">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="mt-3 w-full bg-navy-900 hover:bg-navy-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-md px-5 py-2.5 transition"
      >
        {sending ? "One moment…" : "Email me my results"}
      </button>
      {children}
      <p className="text-xs text-slate-500 mt-3 text-center">
        Only your results. No newsletters unless you opt in. See our{" "}
        <Link to="/privacy" target="_blank" className="underline hover:text-navy-600 transition">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
}

export function WaitScreenEmailOffer({ requestRef, flow }) {
  const [state, setState] = useState("open");
  if (state === "skipped") return null;
  if (state === "sent") {
    return (
      <p className="mt-6 max-w-sm text-sm font-medium text-navy-800" role="status">
        Got it. We'll email your results as soon as they're ready.
      </p>
    );
  }
  return (
    <div className="mt-6 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-700 mb-3 text-left">
        While we research your market, want a copy sent to you? We'll email
        your results and a link back to them, so your numbers are ready before
        your call.
      </p>
      <EmailForm request={{ requestRef, flow }} onSent={() => setState("sent")}>
        <button
          type="button"
          onClick={() => setState("skipped")}
          className="mt-2 w-full text-sm text-slate-600 underline hover:text-navy-600 transition"
        >
          No thanks
        </button>
      </EmailForm>
    </div>
  );
}

// Below the main results and away from the buy buttons. Hidden when there's no
// saved analysis to send, or when they already asked.
export function EmailResultsOffer({ submissionId, flow }) {
  const [sent, setSent] = useState(false);
  const [already] = useState(() => wasEmailed(submissionId));
  if (!submissionId || already) return null;
  return (
    <section className="print:hidden max-w-md mx-auto w-full rounded-xl border border-slate-200 bg-white p-5">
      {sent ? (
        <p className="text-sm font-medium text-navy-800 text-center" role="status">
          On its way. Check your inbox for your results.
        </p>
      ) : (
        <>
          <h2 className="font-serif font-semibold text-navy-900 mb-1">Want a copy sent to you?</h2>
          <p className="text-sm text-slate-700 mb-3">
            We'll email your results and a link back to them, so your numbers
            are ready before your call.
          </p>
          <EmailForm request={{ submissionId, flow }} onSent={() => setSent(true)} />
        </>
      )}
    </section>
  );
}
