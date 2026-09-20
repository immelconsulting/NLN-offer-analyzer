import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage.jsx";
import OfferForm from "./components/OfferForm.jsx";
import ApplyForm from "./components/ApplyForm.jsx";
import ThankYou from "./components/ThankYou.jsx";
import ResultsPage from "./components/ResultsPage.jsx";
import ApplyResultsPage from "./components/ApplyResultsPage.jsx";
import ProofPage from "./components/ProofPage.jsx";
import SessionProofPage from "./components/SessionProofPage.jsx";
import BookingPage from "./components/BookingPage.jsx";
import ScriptPage from "./components/ScriptPage.jsx";
import PrivacyPolicy from "./components/PrivacyPolicy.jsx";
import AdminPage from "./components/AdminPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Offer flow: an offer already in hand. */}
      <Route path="/offer" element={<OfferForm />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/proof" element={<ProofPage />} />

      {/* Pre-offer flows: no offer yet, preparing for the salary question.
          Applying and Interviewing share every component and differ only in
          copy (src/lib/stages.js). All flows converge on /script, which
          branches on the stashed flow. */}
      <Route path="/apply" element={<ApplyForm flow="apply" />} />
      <Route path="/apply/results" element={<ApplyResultsPage flow="apply" />} />
      <Route path="/apply/proof" element={<ProofPage flow="apply" />} />

      <Route path="/interview" element={<ApplyForm flow="interview" />} />
      <Route path="/interview/results" element={<ApplyResultsPage flow="interview" />} />
      <Route path="/interview/proof" element={<ProofPage flow="interview" />} />

      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/session" element={<SessionProofPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/script" element={<ScriptPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
