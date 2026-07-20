import { Link } from "react-router-dom";
import wordmarkWhite from "../assets/nln-wordmark-white.png";

// Dark navy top bar with the white wordmark, shared by every page.
// Hidden in print so PDFs don't render a white-on-white logo.
export default function SiteHeader() {
  return (
    <div className="bg-navy-950 print:hidden">
      <div className="max-w-3xl mx-auto px-6 py-5">
        <Link to="/">
          <img
            src={wordmarkWhite}
            alt="Next Level Negotiation"
            className="h-10 sm:h-12 w-auto"
          />
        </Link>
      </div>
    </div>
  );
}
