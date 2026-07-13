import { Link } from "react-router-dom";
import wordmark from "../assets/nln-wordmark.png";
import { CONTACT_EMAIL } from "../lib/config.js";

export default function ThankYou() {
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

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 mb-3">
            You're all set!
          </h1>
          <p className="text-slate-700 max-w-md mx-auto">
            We'll be in touch with resources for your stage of the job search.
            When you have an offer in hand, come back and run it through the
            Offer Analyzer.
          </p>
          <Link
            to="/"
            className="inline-block mt-6 bg-navy-900 hover:bg-navy-600 text-white font-medium rounded-md px-6 py-3 transition"
          >
            Back to Home
          </Link>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Questions? Reach out at{" "}
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
