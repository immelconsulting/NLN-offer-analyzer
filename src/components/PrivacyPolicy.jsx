import { Link } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import { CONTACT_EMAIL } from "../lib/config.js";

const EFFECTIVE_DATE = "July 19, 2026";

function SectionHeading({ children }) {
  return (
    <h2 className="text-lg font-serif font-semibold text-navy-900 mt-8 mb-3">
      {children}
    </h2>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900">
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Effective {EFFECTIVE_DATE}
          </p>

          <p className="text-slate-700 mt-6">
            Next Level Negotiation ("NLN," "we," "us") respects your privacy.
            This policy explains what information we collect through our offer
            analyzer and script generator tool, and how we use it.
          </p>

          <SectionHeading>Information we collect</SectionHeading>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            <li>Your email address, provided when you use our tool</li>
            <li>
              Details you enter about your job offer (role, location, salary
              figures, and any additional context you provide) — used only to
              generate your personalized analysis and script
            </li>
            <li>
              Basic usage data, such as which stage of your job search you
              selected
            </li>
          </ul>

          <SectionHeading>How we use your information</SectionHeading>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            <li>To generate your offer analysis and negotiation script</li>
            <li>To send you the results you requested</li>
            <li>
              If you opt in, to send you occasional negotiation tips and
              resources by email
            </li>
            <li>To improve our tool and understand how it's used</li>
          </ul>

          <SectionHeading>How we share your information</SectionHeading>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            <li>
              We use Anthropic's Claude API to generate your analysis and
              script; your offer details are processed by Anthropic's API for
              this purpose
            </li>
            <li>We use Stripe to process payments for paid features</li>
            <li>
              We send emails directly from our own email account; if we adopt
              a third-party email service provider in the future, it will
              process your email address on our behalf and we'll update this
              policy
            </li>
            <li>We do not sell your personal information to third parties</li>
          </ul>

          <SectionHeading>Your choices</SectionHeading>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            <li>
              You can unsubscribe from marketing emails at any time using the
              link in any email we send
            </li>
            <li>
              You can contact us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-navy-600 hover:text-navy-900 transition"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              with questions or to request that your information be deleted
            </li>
          </ul>

          <SectionHeading>Changes to this policy</SectionHeading>
          <p className="text-slate-700">
            We may update this policy from time to time. The effective date
            above reflects the most recent update.
          </p>
        </div>

        <p className="text-center mt-6">
          <Link
            to="/"
            className="inline-block py-2 text-sm font-medium text-navy-700 hover:text-navy-900 transition"
          >
            ← Back to Home
          </Link>
        </p>
      </main>
    </div>
  );
}
