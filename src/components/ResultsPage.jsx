import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { decodeResult } from "../lib/encodeResult.js";
import ScoreCard from "./ScoreCard.jsx";
import OpportunityList from "./OpportunityList.jsx";
import StrategyCards from "./StrategyCards.jsx";
import ShareButton from "./ShareButton.jsx";
import wordmark from "../assets/nln-wordmark.png";
import { STRIPE_PAYMENT_LINK_URL, SCHEDULING_URL } from "../lib/config.js";

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const encoded = searchParams.get("d");

  const data = useMemo(() => {
    if (!encoded) return null;
    try {
      return decodeResult(encoded);
    } catch {
      return null;
    }
  }, [encoded]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-50 px-6">
        <div className="text-center">
          <p className="text-lg font-medium text-navy-900 mb-2">
            We couldn't load this result.
          </p>
          <p className="text-slate-600 mb-6">
            The link may be broken or incomplete.
          </p>
          <Link
            to="/"
            className="inline-block bg-navy-900 text-white rounded-md px-5 py-2.5 font-medium hover:bg-navy-600 transition"
          >
            Analyze a New Offer
          </Link>
        </div>
      </div>
    );
  }

  const { form, analysis } = data;

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
            Your Offer Analysis
          </h1>
          <p className="text-navy-200 mt-3">
            {form.role}
            {form.company ? ` at ${form.company}` : ""} · {form.location}
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <ScoreCard score={analysis.offerScore} interpretation={analysis.scoreInterpretation} />

        <OpportunityList opportunities={analysis.opportunities} />

        <StrategyCards strategies={analysis.strategies} />

        <div className="bg-navy-900 text-white rounded-xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 mb-2">
            Recommended Next Step
          </p>
          <p className="text-lg">{analysis.recommendedNextStep}</p>
        </div>

        <NextStepChoice encoded={encoded} />

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <ShareButton />
          <Link
            to="/"
            className="text-sm font-medium text-navy-700 hover:text-navy-900 transition"
          >
            ← Analyze another offer
          </Link>
        </div>

      </main>
    </div>
  );
}

function NextStepChoice({ encoded }) {
  function handleGetScript() {
    // Keep the offer data in this browser so the post-payment page can
    // generate the script after the round-trip through Stripe.
    if (encoded) {
      localStorage.setItem("nln:pendingScript", encoded);
    }
    window.location.href = STRIPE_PAYMENT_LINK_URL;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <p className="font-serif font-semibold text-navy-900 text-xl text-center mb-6">
        What do you want next — a script you can run yourself, or a
        negotiator in your corner?
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={handleGetScript}
          className="rounded-lg bg-navy-900 hover:bg-navy-600 text-white p-5 text-center transition"
        >
          <span className="block font-semibold">Get my custom script</span>
          <span className="block text-sm text-navy-100 mt-1">
            A full counter-offer script written for your exact offer
          </span>
        </button>
        <a
          href={SCHEDULING_URL}
          className="rounded-lg border-2 border-navy-900 text-navy-900 hover:bg-navy-50 p-5 text-center transition"
        >
          <span className="block font-semibold">Talk to a negotiator</span>
          <span className="block text-sm text-slate-600 mt-1">
            Schedule a call and get an expert in your corner
          </span>
        </a>
      </div>
    </div>
  );
}
