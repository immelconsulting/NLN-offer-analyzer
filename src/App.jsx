import { Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage.jsx";
import OfferForm from "./components/OfferForm.jsx";
import ThankYou from "./components/ThankYou.jsx";
import ResultsPage from "./components/ResultsPage.jsx";
import ScriptPage from "./components/ScriptPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/offer" element={<OfferForm />} />
      <Route path="/thanks" element={<ThankYou />} />
      <Route path="/results" element={<ResultsPage />} />
      <Route path="/script" element={<ScriptPage />} />
    </Routes>
  );
}
