import { Link } from "react-router-dom";
import wordmark from "../assets/nln-wordmark.png";
import { CONTACT_EMAIL, SCHEDULING_URL } from "../lib/config.js";

const RESOURCES = {
  databases: {
    title: "Public Salary Databases",
    file: "/resources/nln-public-salary-databases.pdf",
    blurb:
      "Negotiations are won with preparation, and preparation starts with market research. This guide covers the salary databases we trust — Salary.com, Glassdoor, Levels.fyi, Payscale, and more — who each one is best for, and how to use them to find the right anchor point for your conversations.",
  },
  screening: {
    title: "Recruiter Screening Call Script",
    file: "/resources/nln-recruiter-screening-call.pdf",
    blurb:
      'Negotiation doesn\'t start at the offer — it starts on the very first call, when the recruiter asks "What are your salary expectations?" Answer wrong and you\'ve either low-balled yourself or priced yourself out. This script shows you exactly how to handle the "gotcha" questions.',
  },
  offerCall: {
    title: "Offer Call Script",
    file: "/resources/nln-offer-call.pdf",
    blurb:
      "99% of the time, the first offer is not the company's best — recruiters expect you to negotiate and leave room in the budget for it. This script walks you through the offer call itself: show genuine appreciation, understand the full package, and buy time to negotiate — without hurting goodwill.",
  },
};

const STAGE_CONTENT = {
  Applying: {
    intro:
      "You're at the perfect stage to prepare — negotiation starts way earlier than most people think, and the groundwork you do now is what wins later.",
    resources: [RESOURCES.databases, RESOURCES.screening],
  },
  Interviewing: {
    intro:
      "Interviews are where the negotiation quietly begins — recruiters are already asking questions designed to anchor your salary. Here's how to be ready for them.",
    resources: [RESOURCES.databases, RESOURCES.screening],
  },
  "Expecting an offer soon": {
    intro:
      "The offer call is where most people lose money in the first 30 seconds — by accepting on the spot. Here's exactly how to handle that call when it comes.",
    resources: [RESOURCES.offerCall],
  },
};

const DEFAULT_CONTENT = {
  intro: "Here are our free resources to prepare you for your negotiation.",
  resources: [RESOURCES.databases, RESOURCES.screening, RESOURCES.offerCall],
};

function getStage() {
  try {
    return JSON.parse(sessionStorage.getItem("nln:lead"))?.stage ?? null;
  } catch {
    return null;
  }
}

export default function ThankYou() {
  const stage = getStage();
  const { intro, resources } = STAGE_CONTENT[stage] ?? DEFAULT_CONTENT;
  const expectingOffer = stage === "Expecting an offer soon";

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

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900">
            You're all set — here's your negotiation prep kit.
          </h1>
          <p className="text-slate-700 max-w-xl mx-auto mt-3">{intro}</p>
        </div>

        {resources.map((r) => (
          <div
            key={r.title}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 sm:flex sm:items-start sm:justify-between sm:gap-6"
          >
            <div>
              <h2 className="text-lg font-serif font-semibold text-navy-900">
                {r.title}
              </h2>
              <p className="text-slate-600 text-sm mt-2">{r.blurb}</p>
            </div>
            <a
              href={r.file}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block shrink-0 mt-4 sm:mt-1 bg-navy-900 hover:bg-navy-600 text-white text-sm font-medium rounded-md px-5 py-2.5 transition"
            >
              Download PDF
            </a>
          </div>
        ))}

        {expectingOffer && (
          <p className="text-center text-sm text-slate-600">
            And when that offer lands, come back and run it through the{" "}
            <Link
              to="/"
              className="font-medium text-navy-600 hover:text-navy-900 transition"
            >
              free Offer Analyzer
            </Link>{" "}
            — we'll build your negotiation strategy from the real numbers.
          </p>
        )}

        <div className="bg-navy-950 text-white rounded-xl p-6 sm:p-8 text-center">
          <h2 className="text-lg font-serif font-semibold">
            Want a negotiator in your corner from day one?
          </h2>
          <p className="text-navy-200 text-sm mt-2 max-w-md mx-auto">
            It's never too early to start strategizing your negotiation — the
            earlier we talk, the more options you have.
          </p>
          <a
            href={SCHEDULING_URL}
            className="inline-block mt-5 bg-white text-navy-900 hover:bg-navy-50 font-medium rounded-md px-6 py-3 transition"
          >
            Book a free consultation
          </a>
        </div>

        <p className="text-center text-sm text-slate-500">
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
