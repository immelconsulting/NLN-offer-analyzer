import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import { track } from "../lib/track.js";
import {
  STRIPE_PAYMENT_LINK_URL,
  STRATEGY_SESSION_PRICE_LABEL,
  TRUSTPILOT_REVIEWS_URL,
  FREE_TEST_MODE,
} from "../lib/config.js";

// Copy differs per flow; everything structural below is shared. The offer
// flow is the default so its behavior is untouched by the apply path.
const FLOW_COPY = {
  offer: {
    heading: "You're not the only one who wondered if this actually works.",
    proofPoints: [
      "100% 5-star reviews on Trustpilot — 20 verified reviews",
      "Real outcomes: an average 8% salary increase, with one client offer increasing by as much as $30,000",
      "5+ years and 200+ negotiations behind every script — not a generic AI template",
      "Delivered instantly — a fully customized script ready in under 5 minutes, because negotiation calls don't wait for a good time",
    ],
    ctaLabel: "Get my instant script — $47",
    // Specific to the counter-offer script product. Deliberately not reused
    // on the apply page, which sells a different script.
    testimonial: {
      quote:
        "His high-level script provided me with immense confidence during my negotiation call.",
      attribution: "— VP of Finance, June 2024",
    },
  },
  apply: {
    heading: "The call that decides your salary happens before the offer.",
    proofPoints: [
      "100% 5-star reviews on Trustpilot — 20 verified reviews",
      "Word-for-word answers to the two questions that cost people the most: what are your expectations, and what do you make now",
      "5+ years and 200+ negotiations behind every script — not a generic AI template",
      "Delivered instantly — a fully customized script ready in under 5 minutes, because recruiter calls don't wait for a good time",
    ],
    ctaLabel: "Get my screening call script — $47",
    // TODO: drop in a real quote from someone who used the screening call
    // script. Never reuse the counter-offer testimonial here — it's about a
    // different product and a different moment in the process.
    testimonial: null,
  },
};

// Trust-building step between the results page and Stripe checkout.
// Reached via /proof?d=… (offer) or /apply/proof?d=… (applying).
export default function ProofPage({ flow = "offer" }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const encoded = searchParams.get("d");
  const copy = FLOW_COPY[flow] || FLOW_COPY.offer;

  useEffect(() => {
    track("proof_viewed");
  }, []);

  function stashOfferData() {
    // The /script page picks this up — after the round-trip through Stripe
    // on the paid path, or immediately on the free test path.
    if (encoded) {
      localStorage.setItem("nln:pendingScript", encoded);
    }
  }

  function handleCheckout() {
    track("script_checkout_clicked");
    stashOfferData();
    window.location.href = STRIPE_PAYMENT_LINK_URL;
  }

  function handleFreeTest() {
    stashOfferData();
    // Same destination as the Stripe redirect; the server honors this
    // session id only while ALLOW_TEST_BYPASS is set.
    navigate("/script?session_id=test_skip_payment");
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 text-center">
            {copy.heading}
          </h1>

          <ul className="mt-8 space-y-4">
            {copy.proofPoints.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-navy-50 text-navy-600 text-sm font-semibold flex items-center justify-center">
                  ✓
                </span>
                <span className="text-slate-700">{point}</span>
              </li>
            ))}
          </ul>

          {copy.testimonial && (
            <blockquote className="mt-8 bg-navy-50 rounded-lg px-6 py-5 text-center">
              <p className="text-navy-900 font-medium">
                "{copy.testimonial.quote}"
              </p>
              <cite className="block text-sm text-slate-600 not-italic mt-2">
                {copy.testimonial.attribution}
              </cite>
            </blockquote>
          )}

          <div className="mt-6 text-center">
            <a
              href={TRUSTPILOT_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-navy-600 hover:text-navy-900 transition"
            >
              {/* Trustpilot brand green */}
              <span className="text-[#00B67A]" aria-hidden="true">★★★★★</span>
              Read all 20 reviews on Trustpilot →
            </a>
          </div>

          <div className="mt-10 text-center">
            <p className="text-4xl font-serif font-bold text-navy-900">$47</p>
            <p className="text-sm font-medium text-navy-600 mt-1">
              Founding member / early access price
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Early access rate — may increase as we grow.
            </p>
          </div>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleCheckout}
              className="w-full bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-4 transition shadow-sm"
            >
              {copy.ctaLabel}
            </button>
            <Link
              to="/session"
              className="block w-full text-center rounded-md border border-slate-300 text-navy-800 font-medium px-6 py-3.5 hover:border-navy-600 hover:bg-navy-50 transition"
            >
              Book a Negotiation Strategy Session instead
            </Link>
            <p className="text-center text-xs text-slate-500">
              1:1 support from a Next Level Negotiation strategist — sessions
              start at {STRATEGY_SESSION_PRICE_LABEL}.
            </p>
            {FREE_TEST_MODE && (
              <button
                type="button"
                onClick={handleFreeTest}
                className="block w-full text-center text-sm text-slate-400 underline hover:text-navy-600 transition pt-1"
              >
                [Testing] Generate my script free — skip payment
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
