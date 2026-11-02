import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import { TRUSTPILOT_REVIEWS_URL } from "../lib/config.js";
import { track } from "../lib/track.js";

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

// Each stage that has a real flow of its own routes to it; the rest still
// get the stage-matched prep resources on /thanks.
const STAGE_ROUTES = {
  "Received an offer": "/offer",
  Applying: "/apply",
  Interviewing: "/interview",
  "Expecting an offer soon": "/offer-soon",
};

export default function LandingPage() {
  useEffect(() => {
    track("landing_viewed");
  }, []);

  const navigate = useNavigate();

  // Straight to the form: no email before the analysis. The stage is kept for
  // the older /thanks page.
  function chooseStage(stage) {
    try {
      sessionStorage.setItem("nln:lead", JSON.stringify({ stage }));
    } catch {
      // Only used by /thanks; carry on without it.
    }
    navigate(STAGE_ROUTES[stage] || "/thanks");
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <header>
        <div className="max-w-3xl mx-auto px-6 pt-12 pb-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-navy-600 mb-3">
            Job Offer Analyzer
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-navy-950">
            Only 42% of job seekers negotiate. Nearly 9 in 10 who do, win.
          </h1>
          <p className="text-slate-700 mt-4 max-w-xl">
            See exactly where your offer has room to grow.
          </p>
          <p className="text-slate-700 mt-2 max-w-xl font-medium">
            Free. No sign-up. Your analysis is ready in about 3 minutes.
          </p>
          <a
            href={TRUSTPILOT_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-navy-600 hover:bg-navy-800 px-4 py-1.5 text-sm text-white transition"
          >
            <span aria-hidden="true">★</span>
            100% 5-star reviews on Trustpilot (20 verified)
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-lg font-serif font-semibold text-navy-900 mb-1">
              Where are you in your job search right now?
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Wherever you are, we'll tailor your analysis to the conversation
              in front of you.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              {STAGES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => chooseStage(s.value)}
                  className="text-left rounded-lg border p-4 transition border-slate-300 bg-white hover:border-navy-600 hover:bg-navy-50"
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

          <p className="text-center text-sm text-slate-500">
            This tool uses AI, guided by NLN's negotiation methodology, to
            generate your offer analysis and script. Submissions are saved so
            our team can prepare if you book a coaching call, and anonymized,
            aggregated compensation data may help inform other users'
            analyses. See our{" "}
            <Link to="/privacy" className="underline hover:text-navy-600 transition">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
