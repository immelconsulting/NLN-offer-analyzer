import { Link } from "react-router-dom";
import wordmarkWhite from "../assets/nln-wordmark-white.png";

// Dark navy top bar with the white wordmark and the product name, shared by
// every page, so visitors arriving from a "Job Offer Analyzer" promotion see
// that name wherever they land. Hidden in print so PDFs don't render a
// white-on-white logo.
export default function SiteHeader() {
  return (
    <div className="bg-navy-950 print:hidden">
      <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <Link to="/">
          <img
            src={wordmarkWhite}
            alt="Next Level Negotiation"
            className="h-10 sm:h-12 w-auto"
          />
        </Link>
        <Link
          to="/"
          className="text-right font-serif font-semibold text-navy-100 hover:text-white text-sm sm:text-base leading-tight transition"
        >
          Job Offer Analyzer
        </Link>
      </div>
    </div>
  );
}
