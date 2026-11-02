import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProofContent from "./ProofContent.jsx";
import ScriptPreview, { useScriptPreview } from "./ScriptPreview.jsx";
import MeetJennyLink from "./MeetJennyLink.jsx";
import { NextStepChoice } from "./RangeBlocks.jsx";
import { track } from "../lib/track.js";
import { startScriptCheckout } from "../lib/checkoutUrl.js";
import { STRIPE_PAYMENT_LINK_URL } from "../lib/config.js";

// The bottom of every results page: the start of their script, a way to unlock
// it, and a way to book a session instead. A buy button and a session button
// are on the page from the first moment, whatever the preview is doing.

function DetailsPopup({ flow, form, onCheckout, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-details-heading"
        className="relative mx-auto my-4 sm:my-10 w-[calc(100%-2rem)] max-w-2xl bg-white rounded-xl shadow-xl p-6 pt-12 sm:p-10"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-9 w-9 rounded-full text-xl text-slate-500 hover:bg-navy-50 hover:text-navy-900 transition"
        >
          ×
        </button>
        <ProofContent flow={flow} form={form} onCheckout={onCheckout} headingId="script-details-heading" />
      </div>
    </div>
  );
}

export default function ScriptOffer({ flow, encoded, form, submissionId, scriptBlurb }) {
  const navigate = useNavigate();
  const preview = useScriptPreview(submissionId);
  const [showDetails, setShowDetails] = useState(false);

  function checkout() {
    startScriptCheckout(STRIPE_PAYMENT_LINK_URL, encoded, submissionId);
  }
  function openDetails() {
    track("proof_viewed");
    setShowDetails(true);
  }
  function bookSession() {
    track("session_cta_clicked");
    navigate("/session");
  }

  return (
    <>
      <ScriptPreview state={preview} onUnlock={checkout} onDetails={openDetails} />

      {preview.status === "ready" ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center print:hidden">
          <p className="font-serif font-semibold text-navy-900 text-xl">
            Want Jenny Foss to help you prepare?
          </p>
          <button
            type="button"
            onClick={bookSession}
            className="mt-4 w-full sm:w-auto sm:min-w-80 rounded-lg border-2 border-navy-900 text-navy-900 hover:bg-navy-50 px-6 py-4 transition"
          >
            <span className="block font-semibold">Book a Strategy Session</span>
            <span className="block text-sm text-slate-600 mt-1">
              Prepare with Jenny Foss before your negotiation calls
            </span>
          </button>
          <p className="text-sm text-slate-500 mt-4">
            Who's Jenny Foss?{" "}
            <MeetJennyLink className="text-navy-600 hover:text-navy-900" />
          </p>
        </div>
      ) : (
        <NextStepChoice
          scriptBlurb={scriptBlurb}
          onGetScript={() => {
            track("script_cta_clicked");
            openDetails();
          }}
          onBookSession={bookSession}
        />
      )}

      {showDetails && (
        <DetailsPopup flow={flow} form={form} onCheckout={checkout} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}
