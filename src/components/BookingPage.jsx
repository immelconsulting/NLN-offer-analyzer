import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import icon from "../assets/nln-icon.png";
import { CONTACT_EMAIL, THRIVE_BOOKING_URL } from "../lib/config.js";
import { track } from "../lib/track.js";

// Post-payment destination for the Negotiation Strategy Session. Both Stripe
// Payment Links (30 min and 60 min) redirect here with
// ?session_id={CHECKOUT_SESSION_ID}. We confirm the payment server-side
// before showing the calendar link, so the booking URL isn't reachable by
// anyone who simply guesses this route.
export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState("checking"); // checking | paid | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError(
        "This page needs to be reached through the payment confirmation link."
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "We couldn't verify your payment.");
        if (!cancelled) {
          setStatus("paid");
          track("booking_confirmed");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setError(err.message || "We couldn't verify your payment.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-6">
        {status === "checking" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 flex flex-col items-center text-center">
            <img src={icon} alt="NLN" className="h-12 w-auto animate-pulse mb-6" />
            <div className="h-10 w-10 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin mb-6" />
            <p className="text-xl font-serif font-semibold text-navy-900">
              Confirming your payment…
            </p>
          </div>
        )}

        {status === "paid" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center">
            <h1 className="text-2xl sm:text-3xl font-serif font-semibold text-navy-900">
              You're all set — now pick your time.
            </h1>
            <p className="text-slate-700 mt-3 max-w-md mx-auto">
              Your Negotiation Strategy Session is paid for. Choose a slot on
              your strategist's calendar and you'll get a confirmation by
              email.
            </p>
            <a
              href={THRIVE_BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-6 bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-4 transition shadow-sm"
            >
              Book my session time →
            </a>
            <p className="text-xs text-slate-500 mt-4">
              Bookmark this page — you can come back to it if you need to
              schedule later.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center">
            <h1 className="text-xl font-serif font-semibold text-navy-900 mb-3">
              We couldn't confirm that payment.
            </h1>
            <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3 mb-6 text-left">
              {error}
            </div>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              If you were charged, email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-navy-600 hover:text-navy-900 transition"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              and we'll get you booked right away.
            </p>
            <Link
              to="/session"
              className="inline-block mt-6 rounded-md border border-navy-900 text-navy-900 font-medium px-5 py-2.5 hover:bg-navy-50 transition"
            >
              Back to session options
            </Link>
          </div>
        )}

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
