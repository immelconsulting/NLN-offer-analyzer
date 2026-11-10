import { Link, useLocation } from "react-router-dom";
import WhoIsBehindThis from "./BioModal.jsx";

// Shown under every page (rendered once in App.jsx). NLN's own website is out
// of date (Alex, Nov 2026), so nothing links there: "Who's behind this?" opens
// the bio instead. On the landing page its main button sends them to the
// stage choice; anywhere else it just closes, so nobody is pulled away from
// their results or script.
function focusStageChoice() {
  const first = document.querySelector("#stage-choice button");
  first?.scrollIntoView({ block: "center", behavior: "smooth" });
  first?.focus({ preventScroll: true });
}

export default function SiteFooter() {
  const onLanding = useLocation().pathname === "/";
  return (
    <footer className="bg-navy-50 border-t border-navy-100">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
        <p>Job Offer Analyzer by Next Level Negotiation</p>
        <p className="flex items-center gap-4">
          <WhoIsBehindThis
            className="print:hidden"
            primaryLabel={onLanding ? "Get my number" : "Close"}
            onPrimary={onLanding ? focusStageChoice : undefined}
          />
          <Link to="/privacy" className="text-navy-600 hover:text-navy-900 print:hidden">
            Privacy Policy
          </Link>
        </p>
      </div>
    </footer>
  );
}
