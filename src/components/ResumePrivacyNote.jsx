import { Link } from "react-router-dom";

// Under every resume upload. Worded to match what the code does: only the
// extracted text is kept, on the submission, and it goes to Jenny with a session
// booking (see the privacy policy). Don't promise the text isn't stored.
export default function ResumePrivacyNote() {
  return (
    <p className="text-sm text-slate-500 mt-1.5">
      Optional. We use the text to tailor your analysis and script, and we save that text (not your
      file) so Jenny can prepare if you book a session. Details in our{" "}
      <Link to="/privacy" className="underline hover:text-navy-600 transition">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
