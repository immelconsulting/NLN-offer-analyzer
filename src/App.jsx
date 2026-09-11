import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage.jsx";
import OfferForm from "./components/OfferForm.jsx";
import ThankYou from "./components/ThankYou.jsx";
import ResultsPage from "./components/ResultsPage.jsx";
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
      <Route path="/offer" element={<OfferForm />} />
      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/proof" element={<ProofPage />} />
      <Route path="/session" element={<SessionProofPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/script" element={<ScriptPage />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
