import { Link } from "react-router-dom";
import WhoIsBehindThis from "./BioModal.jsx";

// Shown under every page (rendered once in App.jsx). NLN's own website is out
// of date (Alex, Nov 2026), so nothing links there: "Who's behind this?" opens
// the bio instead.
export default function SiteFooter() {
  return (
    <footer className="bg-navy-50 border-t border-navy-100">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
        <p>Built by Next Level Negotiation in partnership with JobJenny.com.</p>
        <p className="flex items-center gap-4">
          <WhoIsBehindThis className="print:hidden" />
          <Link to="/privacy" className="text-navy-600 hover:text-navy-900 print:hidden">
            Privacy Policy
          </Link>
        </p>
      </div>
    </footer>
  );
}
