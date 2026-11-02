import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { encodeResult } from "../lib/encodeResult.js";
import { getFlow } from "../lib/flows.js";
import { rememberAnalysis } from "../lib/checkoutUrl.js";

// Where an emailed results link lands (/r/<id>?t=<token>). Results normally
// live entirely in the ?d= URL, which is too long for an email, so this loads
// the saved analysis and hands over to the normal results page.
export default function ResultsLinkPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("t");
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/results?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token || "")}`);
        if (!res.ok) throw new Error("not found");
        const { flow, form, analysis } = await res.json();
        if (cancelled) return;
        rememberAnalysis(analysis.submissionId);
        const encoded = encodeResult(flow === "offer" ? { form, analysis } : { flow, form, analysis });
        navigate(`${getFlow(flow).resultsPath}?d=${encoded}`, { replace: true });
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-50 px-6">
      <div className="text-center">
        {failed ? (
          <>
            <p className="text-lg font-medium text-navy-900 mb-2">We couldn't load those results.</p>
            <p className="text-slate-600 mb-6">The link may be broken or incomplete. Your emailed summary still has your numbers.</p>
            <Link to="/" className="inline-block bg-navy-900 text-white rounded-md px-5 py-2.5 font-medium hover:bg-navy-600 transition">
              Start a new analysis
            </Link>
          </>
        ) : (
          <p className="text-navy-900 font-medium" role="status">Loading your results…</p>
        )}
      </div>
    </div>
  );
}
