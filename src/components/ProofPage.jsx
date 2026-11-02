import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import SiteHeader from "./SiteHeader.jsx";
import ProofContent from "./ProofContent.jsx";
import ScriptPreview, { useScriptPreview } from "./ScriptPreview.jsx";
import { track } from "../lib/track.js";
import { decodeResult } from "../lib/encodeResult.js";
import { startScriptCheckout } from "../lib/checkoutUrl.js";
import { STRIPE_PAYMENT_LINK_URL, FREE_TEST_MODE } from "../lib/config.js";

// Standalone version of the script's sales content, reached via /proof?d=…,
// /apply/proof?d=… and so on. The results pages now show this in a pop-up, so
// this mostly serves links people already have.
export default function ProofPage({ flow = "offer" }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const encoded = searchParams.get("d");

  const decoded = useMemo(() => {
    try {
      return encoded ? decodeResult(encoded) : null;
    } catch {
      return null;
    }
  }, [encoded]);
  const submissionId = decoded?.analysis?.submissionId;

  // Loads on its own below the buy buttons, which never wait for it.
  const preview = useScriptPreview(submissionId);

  useEffect(() => {
    track("proof_viewed");
  }, []);

  function handleCheckout() {
    startScriptCheckout(STRIPE_PAYMENT_LINK_URL, encoded, submissionId);
  }

  function handleFreeTest() {
    if (encoded) localStorage.setItem("nln:pendingScript", encoded);
    // Same destination as the Stripe redirect; the server honors this
    // session id only while ALLOW_TEST_BYPASS is set.
    navigate("/script?session_id=test_skip_payment");
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
          <ProofContent flow={flow} form={decoded?.form} onCheckout={handleCheckout}>
            {preview.status === "ready" && (
              <p className="text-center text-sm pt-1">
                <a href="#script-preview" className="font-medium text-navy-600 hover:text-navy-900 underline">
                  See a preview of your script
                </a>
              </p>
            )}
            {FREE_TEST_MODE && (
              <button
                type="button"
                onClick={handleFreeTest}
                className="block w-full text-center text-sm text-slate-400 underline hover:text-navy-600 transition pt-1"
              >
                [Testing] Generate my script free (skip payment)
              </button>
            )}
          </ProofContent>
        </div>

        <ScriptPreview state={preview} onUnlock={handleCheckout} />
      </main>
    </div>
  );
}
