import { useEffect } from "react";
import SiteHeader from "./SiteHeader.jsx";
import { track } from "../lib/track.js";
import {
  STRATEGY_SESSION_30MIN_CHECKOUT_URL,
  STRATEGY_SESSION_60MIN_CHECKOUT_URL,
  STRATEGY_SESSION_PRICE_LABEL,
  STRATEGY_SESSION_PRICE_LABEL_60MIN,
  FREE_TEST_MODE,
} from "../lib/config.js";

// Sells the paid 1:1 Negotiation Strategy Session. Structurally mirrors
// ProofPage.jsx (which sells the $47 self-serve script), but the two pages
// address different audiences and the copy here should not be synced to it.
//
// AUDIENCE: mostly JobJenny coaching clients who just finished their
// resume/LinkedIn work and were sent straight here as the next step — not
// cold traffic discovering the tool, and often people who have never touched
// the self-serve script. So the copy leans on the JobJenny relationship they
// already trust, and deliberately never frames a session as the better
// choice over the script; for most visitors here the script isn't the thing
// they're weighing it against.
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
  "One-on-one time with a JobJenny negotiation coach, working from your actual target role, your numbers, and the specific conversation ahead of you, not generic advice.",
  "You don't need an offer in hand to book this. The earlier you prep, the more room you have to shape how the conversation goes.",
  "Real conversations rarely go the way you rehearsed. Your coach can adjust in real time to whatever the recruiter or hiring manager actually says back.",
  "Built on Next Level Negotiation's methodology, the same approach behind hundreds of real negotiations, applied to your specific situation.",
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
  useEffect(() => {
    track("session_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 text-center">
            Your resume is polished. Let's make sure your negotiation is too.
          </h1>
          <p className="text-slate-700 text-center mt-3 max-w-xl mx-auto">
            You've already put in the work on your resume and LinkedIn. A
            Negotiation Strategy Session with your JobJenny coach makes sure
            that work actually pays off, literally, when it's time to talk
            numbers.
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
                  // Beacon fires and the link navigates as normal — no
                  // preventDefault, so checkout is never delayed by tracking.
                  onClick={() =>
                    track("session_checkout_clicked", { tier: tier.duration })
                  }
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
