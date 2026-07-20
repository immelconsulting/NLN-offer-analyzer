import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";

const STAGES = [
  {
    value: "Applying",
    label: "Applying",
    description: "I'm sending out applications",
  },
  {
    value: "Interviewing",
    label: "Interviewing",
    description: "I'm in the interview process",
  },
  {
    value: "Received an offer",
    label: "Received an offer",
    description: "I have an offer in hand",
  },
  {
    value: "Expecting an offer soon",
    label: "Expecting an offer soon",
    description: "An offer is likely on its way",
  },
];

// Only an offer in hand can be analyzed; everyone else gets the
// stage-matched prep resources on /thanks.
const HAS_OFFER_STAGES = ["Received an offer"];

export default function LandingPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("");
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue(e) {
    e.preventDefault();
    if (!stage) {
      setError("Please select where you are in your job search.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setSubmitting(true);

    const lead = { email: email.trim(), stage, marketingOptIn };
    sessionStorage.setItem("nln:lead", JSON.stringify(lead));

    // Store the lead, but never block the visitor on storage problems.
    try {
      await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch {
      // Ignore — the visitor continues either way.
    }

    if (HAS_OFFER_STAGES.includes(stage)) {
      navigate("/offer");
    } else {
      navigate("/thanks");
    }
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <header>
        <div className="max-w-3xl mx-auto px-6 pt-12 pb-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-navy-950">
            Only 42% of job seekers negotiate. Nearly 9 in 10 who do, win.
          </h1>
          <p className="text-slate-700 mt-4 max-w-xl">
            See exactly where your offer has room to grow — free, no strings
            attached.
          </p>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-navy-600 px-4 py-1.5 text-sm text-white">
            <span aria-hidden="true">★</span>
            100% 5-star reviews on Trustpilot (19 verified)
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <form
          onSubmit={handleContinue}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6"
        >
          <div>
            <h2 className="text-lg font-serif font-semibold text-navy-900 mb-1">
              Where are you in your job search right now?
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              No offer yet? We'll send you prep resources to get you ready for
              one.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {STAGES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(s.value)}
                  className={`text-left rounded-lg border p-4 transition ${
                    stage === s.value
                      ? "border-navy-600 ring-1 ring-navy-600 bg-navy-50"
                      : "border-slate-300 bg-white hover:border-navy-300"
                  }`}
                >
                  <span className="block font-medium text-navy-900">
                    {s.label}
                  </span>
                  <span className="block text-sm text-slate-600 mt-0.5">
                    {s.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy-800 mb-1.5">
              Enter your email so we can send you the right resources for your
              stage<span className="text-rose-600 ml-0.5">*</span>
            </label>
            <input
              type="email"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <p className="text-sm text-slate-500 mt-1.5">
              No spam — just your results and relevant resources.
            </p>
            <label className="flex items-start gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-px h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-600"
              />
              <span className="text-xs text-slate-400">
                Also send me occasional negotiation tips and resources
              </span>
            </label>
            <p className="text-xs text-slate-400 mt-2">
              See our{" "}
              <Link
                to="/privacy"
                className="underline hover:text-navy-600 transition"
              >
                Privacy Policy
              </Link>
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-navy-900 hover:bg-navy-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-md px-6 py-3.5 transition shadow-sm"
          >
            {submitting ? "One moment…" : "Continue"}
          </button>

          <p className="text-center text-sm text-slate-500">
            This tool uses AI, guided by NLN's negotiation methodology, to
            generate your offer analysis and script.
          </p>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Your information is used only to send you relevant resources.
        </p>
      </main>
    </div>
  );
}
