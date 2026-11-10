import { Link } from "react-router-dom";
import MeetJennyLink from "./MeetJennyLink.jsx";
import { STRATEGY_SESSION_PRICE_LABEL, TRUSTPILOT_REVIEWS_URL } from "../lib/config.js";
import headshot from "../assets/alex-headshot.jpg";
import WhoIsBehindThis from "./BioModal.jsx";

// Copy differs per flow; everything structural below is shared. The offer
// flow is the default so its behavior is untouched by the apply path.
const FLOW_COPY = {
  offer: {
    heading: "You're not the only one who wondered if this actually works.",
    proofPoints: [
      "100% 5-star reviews on Trustpilot",
      "Real outcomes: an average 8% salary increase, with one client offer increasing by as much as $30,000",
      "5+ years and 200+ negotiations behind every script, not a generic AI template",
      "Delivered instantly: a fully customized script ready in under 5 minutes, because negotiation calls don't wait for a good time",
    ],
    ctaLabel: "Get my instant script ($47)",
    // Specific to the counter-offer script product. Deliberately not reused
    // on the apply page, which sells a different script.
    testimonial: {
      quote:
        "[The script] provided me with immense confidence during my negotiation call.",
      attribution: "VP of Finance, June 2024",
    },
  },
  // Applying and Interviewing sell the same script; only the heading changes
  // to match where the reader is. The `interview` entry is filled in below
  // from this one so the two can never drift apart by accident.
  apply: {
    heading: "The call that decides your salary happens before the offer.",
    proofPoints: [
      "100% 5-star reviews on Trustpilot",
      "Word-for-word answers to the two questions that cost people the most: what are your expectations, and what do you make now",
      "5+ years and 200+ negotiations behind every script, not a generic AI template",
      "Delivered instantly: a fully customized script ready in under 5 minutes, because recruiter calls don't wait for a good time",
    ],
    ctaLabel: "Get my screening call script ($47)",
    // TODO: drop in a real quote from someone who used the screening call
    // script. Never reuse the counter-offer testimonial here — it's about a
    // different product and a different moment in the process.
    testimonial: null,
  },
};

// Interviewing sells the identical script, so it inherits the apply copy
// wholesale and overrides only the heading.
FLOW_COPY.interview = {
  ...FLOW_COPY.apply,
  heading: "You're in the process. The salary question is coming.",
};

// Expecting an offer soon sells a different script (the offer call), so this
// entry stands on its own rather than inheriting.
FLOW_COPY.offer_soon = {
  heading: "The offer call is where most people leave money on the table.",
  proofPoints: [
    "100% 5-star reviews on Trustpilot",
    "Word-for-word lines for the moment the number lands: how to respond, what to ask, and how to buy time without losing momentum",
    "5+ years and 200+ negotiations behind every script, not a generic AI template",
    "Delivered instantly: a fully customized script in under 5 minutes, because offer calls don't wait for a good time",
  ],
  ctaLabel: "Get my offer call script ($47)",
  // TODO: drop in a real quote from someone who used the offer call script.
  // Never reuse the counter-offer testimonial here — it's about a different
  // product and a different moment in the process.
  testimonial: null,
};

// What the script is worth and the button to buy it: the /proof page for old
// links, and the pop-up on the results pages.
export default function ProofContent({ flow = "offer", form, onCheckout, headingId, children }) {
  const copy = FLOW_COPY[flow] || FLOW_COPY.offer;
  const alreadySharedNumber = (flow === "apply" || flow === "interview") && form?.salaryStage === "gave_number";

  return (
    <>
      <h1 id={headingId} className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900 text-center">
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
          className="inline-flex items-center gap-2 font-medium text-[#00B67A] hover:text-[#00A36D] underline transition"
        >
          {/* Trustpilot brand green */}
          <span aria-hidden="true">★★★★★</span>
          Read our reviews on Trustpilot →
        </a>
      </div>

      {alreadySharedNumber && (
        <p className="mt-8 rounded-lg bg-navy-50 px-5 py-4 text-center text-navy-900 font-medium">
          You've already shared a number. Your script shows how to hold it,
          or reopen it, without backpedaling.
        </p>
      )}

      <div className="mt-10 text-center">
        <p className="text-4xl font-serif font-bold text-navy-900">$47</p>
        <p className="text-sm text-slate-500 mt-1">
          One-time price. Your script is saved, so you can reopen it on any device.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={onCheckout}
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
          1:1 with{" "}
          <MeetJennyLink className="text-slate-600 hover:text-navy-900">
            Jenny Foss
          </MeetJennyLink>{" "}
          of JobJenny.com. Sessions start at{" "}
          {STRATEGY_SESSION_PRICE_LABEL}.
        </p>
        {children}
      </div>

      {/* Below the buttons, so it never pushes checkout down on a phone. */}
      <div className="mt-6 flex items-center gap-3 rounded-lg bg-navy-50 px-4 py-3">
        <img src={headshot} alt="" width="40" height="40" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        <p className="text-sm text-slate-700">
          Your script is built on the same approach Alex has used with 200+ professionals at
          companies like Amazon, TikTok and OpenAI. <WhoIsBehindThis />
        </p>
      </div>
    </>
  );
}
