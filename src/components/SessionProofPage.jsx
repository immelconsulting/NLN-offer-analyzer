import SiteHeader from "./SiteHeader.jsx";
import {
  STRATEGY_SESSION_30MIN_CHECKOUT_URL,
  STRATEGY_SESSION_60MIN_CHECKOUT_URL,
  STRATEGY_SESSION_PRICE_LABEL,
  STRATEGY_SESSION_PRICE_LABEL_60MIN,
  TRUSTPILOT_REVIEWS_URL,
  FREE_TEST_MODE,
} from "../lib/config.js";

// Mirrors ProofPage.jsx (which sells the $47 self-serve script) but sells the
// paid 1:1 Negotiation Strategy Session instead. Reached whenever someone
// chooses the "human" path instead of the DIY script — from the results
// page, the post-script upsell, or the /thanks dead-end for the three
// earlier stages — so the sell happens on its own page instead of a single
// button dropped into someone else's page.
//
// Flow: pick a tier here → Stripe checkout for that tier → /booking, which
// confirms the payment and only then reveals JobJenny's Thrive calendar.
//
// NOTE for Alex: the four points below are deliberately generic and don't
// claim any number that isn't verified (client count, win rate, years in
// business). If you have real, specific stats or a real client quote from
// Jenny/Alisa's practice, swap them in here the same way PROOF_POINTS and the
// blockquote work in ProofPage.jsx — just don't reuse the script testimonial
// from ProofPage, since that quote is about the script product, not a live
// session.
const PROOF_POINTS = [
  "Live, 1:1 coaching from an experienced negotiator, not a static document.",
  "Your strategist adapts in real time to whatever the recruiter actually says, including the objections a script can't predict.",
  "Built on the same negotiation methodology behind your script, applied live to your specific offer and your specific conversation.",
  "Choose 30 or 60 minutes depending on how much support you want going into the call.",
];

const TIERS = [
  {
    price: STRATEGY_SESSION_PRICE_LABEL,
    duration: "30 minutes",
    blurb: "Focused prep for one upcoming conversation.",
    detail:
      "Best if you know your number and want a second set of eyes before you pick up the phone.",
    checkoutUrl: STRATEGY_SESSION_30MIN_CHECKOUT_URL,
    cta: `Book 30 minutes — ${STRATEGY_SESSION_PRICE_LABEL}`,
    featured: false,
  },
  {
    price: STRATEGY_SESSION_PRICE_LABEL_60MIN,
    duration: "A full hour",
    blurb: "Room to work the whole offer and practice out loud.",
    detail:
      "Best if there's real money on the table, the package is complicated, or you want to rehearse the call itself.",
    checkoutUrl: STRATEGY_SESSION_60MIN_CHECKOUT_URL,
    cta: `Book a full hour — ${STRATEGY_SESSION_PRICE_LABEL_60MIN}`,
    featured: true,
  },
];

export default function SessionProofPage() {
  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 text-center">
            A script gets you ready. A strategist gets you through it.
          </h1>
          <p className="text-slate-700 text-center mt-3 max-w-xl mx-auto">
            Some negotiations are simple enough to run yourself. Others go
            better with an experienced negotiator in your corner, live, while
            it's happening.
          </p>

          <ul className="mt-8 space-y-4">
            {PROOF_POINTS.map((point, i) => (
              <li key={i} className="flex gap-3">
                <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-navy-50 text-navy-600 text-sm font-semibold flex items-center justify-center">
                  ✓
                </span>
                <span className="text-slate-700">{point}</span>
              </li>
            ))}
          </ul>

          {/*
            Real client testimonial goes here once there's one for the session
            product specifically (see the note above PROOF_POINTS). Match the
            ProofPage.jsx blockquote pattern:

            <blockquote className="mt-8 bg-navy-50 rounded-lg px-6 py-5 text-center">
              <p className="text-navy-900 font-medium">"..."</p>
              <cite className="block text-sm text-slate-600 not-italic mt-2">
                — Name, Title, Month Year
              </cite>
            </blockquote>
          */}

          <div className="mt-6 text-center">
            <a
              href={TRUSTPILOT_REVIEWS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-medium text-navy-600 hover:text-navy-900 transition"
            >
              {/* Trustpilot brand green */}
              <span className="text-[#00B67A]" aria-hidden="true">★★★★★</span>
              See what past clients say on Trustpilot →
            </a>
          </div>

          <h2 className="mt-10 text-lg font-serif font-semibold text-navy-900 text-center">
            Choose your session
          </h2>

          <div className="mt-5 grid sm:grid-cols-2 gap-4">
            {TIERS.map((tier) => (
              <div
                key={tier.duration}
                className={`relative flex flex-col rounded-xl border p-6 ${
                  tier.featured
                    ? "border-navy-600 ring-1 ring-navy-600 bg-navy-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-6 bg-navy-900 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
                    Most support
                  </span>
                )}
                <p className="text-3xl font-serif font-bold text-navy-900">
                  {tier.price}
                </p>
                <p className="text-sm font-medium text-navy-600 mt-1">
                  {tier.duration}
                </p>
                <p className="text-sm text-slate-700 mt-3">{tier.blurb}</p>
                <p className="text-sm text-slate-500 mt-2 flex-1">
                  {tier.detail}
                </p>
                <a
                  href={tier.checkoutUrl}
                  className={`mt-5 block w-full text-center font-semibold rounded-md px-5 py-3.5 transition shadow-sm ${
                    tier.featured
                      ? "bg-navy-900 hover:bg-navy-600 text-white"
                      : "border border-navy-900 text-navy-900 hover:bg-navy-50"
                  }`}
                >
                  {tier.cta}
                </a>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-slate-500 mt-5">
            You'll pay first, then pick a time on your strategist's calendar.
          </p>

          {FREE_TEST_MODE && (
            <p className="text-center mt-3">
              <a
                href="/booking?session_id=test_skip_payment"
                className="text-sm text-slate-400 underline hover:text-navy-600 transition"
              >
                [Testing] Skip payment and preview the booking step
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
