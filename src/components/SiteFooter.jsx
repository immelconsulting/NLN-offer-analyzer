import { Link } from "react-router-dom";

// Shown under every page (rendered once in App.jsx). Links back to NLN's main
// site; it also prints, so a printed results page carries the address.
export default function SiteFooter() {
  return (
    <footer className="bg-navy-50 border-t border-navy-100">
      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          Job Offer Analyzer by{" "}
          <a
            href="https://www.nextlevelnegotiation.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-navy-600 hover:text-navy-900 underline underline-offset-2"
          >
            Next Level Negotiation
          </a>
        </p>
        <p className="flex items-center gap-4">
          <a
            href="https://www.nextlevelnegotiation.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-navy-600 hover:text-navy-900"
          >
            www.nextlevelnegotiation.com
          </a>
          <Link to="/privacy" className="text-navy-600 hover:text-navy-900 print:hidden">
            Privacy Policy
          </Link>
        </p>
      </div>
    </footer>
  );
}
