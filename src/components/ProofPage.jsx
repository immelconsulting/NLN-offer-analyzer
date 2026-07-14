import { Link, useSearchParams } from "react-router-dom";
import wordmark from "../assets/nln-wordmark.png";
import { STRIPE_PAYMENT_LINK_URL, SCHEDULING_URL } from "../lib/config.js";

const PROOF_POINTS = [
  "100% 5-star reviews on Trustpilot — 19 verified reviews",
  "Real outcomes: clients have added as much as $26,000 to a single offer",
  "Built by a salary negotiation expert with 5 years of experience helping 200+ people negotiate their offers",
  "Delivered instantly — a fully customized script ready in under 5 minutes, because negotiation calls don't wait for a good time",
];

// Trust-building step between the results page and Stripe checkout.
// Reached via /proof?d=<encoded offer data> from the results page.
export default function ProofPage() {
  const [searchParams] = useSearchParams();
  const encoded = searchParams.get("d");

  function handleCheckout() {
    // Same stash the results page used to do — the post-payment /script
    // page picks it up after the round-trip through Stripe.
    if (encoded) {
      localStorage.setItem("nln:pendingScript", encoded);
    }
    window.location.href = STRIPE_PAYMENT_LINK_URL;
  }

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

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 text-center">
            You're not the only one who wondered if this actually works.
          </h1>

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

          <blockquote className="mt-8 border-l-4 border-navy-600 bg-navy-50 rounded-r-lg px-5 py-4">
            <p className="text-navy-900 font-medium">
              "Working with Next Level is worth every penny!"
            </p>
            <cite className="block text-sm text-slate-600 not-italic mt-1">
              — Trustpilot review, June 2023
            </cite>
          </blockquote>

          {/*
            Trustpilot TrustBox widget goes here.
            Paste the embed snippet from the Trustpilot business account
            (Integrations → TrustBox library) inside this div, and move the
            required <script> tag to index.html per Trustpilot's docs.
          */}
          <div
            id="trustpilot-widget"
            className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400"
          >
            Live Trustpilot reviews will appear here
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
              Get my instant script — $47
            </button>
            <a
              href={SCHEDULING_URL}
              className="block w-full text-center rounded-md border border-slate-300 text-navy-800 font-medium px-6 py-3.5 hover:border-navy-600 hover:bg-navy-50 transition"
            >
              Actually, I'd rather talk to someone
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
