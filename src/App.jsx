import { Routes, Route } from "react-router-dom";
import OfferForm from "./components/OfferForm.jsx";
import ResultsPage from "./components/ResultsPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OfferForm />} />
      <Route path="/results" element={<ResultsPage />} />
    </Routes>
  );
}
