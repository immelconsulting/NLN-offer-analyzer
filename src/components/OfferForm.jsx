import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { encodeResult } from "../lib/encodeResult.js";

const INDUSTRIES = [
  "Tech",
  "Sales",
  "Marketing",
  "Consulting",
  "Operations",
  "Data/Analytics",
  "Other",
];

const PRIORITIES = [
  "Base Salary",
  "Bonus",
  "Equity",
  "Title",
  "Remote Work",
  "Start Date",
  "PTO",
  "Other",
];

const initialState = {
  role: "",
  company: "",
  location: "",
  industry: "Tech",
  currentSalary: "",
  offerBaseSalary: "",
  hasBonus: false,
  bonusAmount: "",
  hasSignOnBonus: false,
  signOnBonusAmount: "",
  hasEquity: false,
  equityAmount: "",
  topPriority: "Base Salary",
  hasLeverage: false,
  leverageDetails: "",
  offerDeadline: "",
};

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-medium text-navy-800 mb-1.5">
      {children}
      {required && <span className="text-rose-600 ml-0.5">*</span>}
    </label>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

export default function OfferForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!form.role.trim()) return "Role / job title is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.offerBaseSalary || Number(form.offerBaseSalary) <= 0)
      return "Offer base salary is required.";
    if (form.hasBonus && !form.bonusAmount.trim())
      return "Please provide the bonus amount or percentage.";
    if (form.hasSignOnBonus && !form.signOnBonusAmount.trim())
      return "Please provide the sign-on bonus amount.";
    if (form.hasEquity && !form.equityAmount.trim())
      return "Please provide the approximate equity value or shares.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong analyzing your offer.");
      }
      const analysis = await res.json();
      const encoded = encodeResult({ form, analysis });
      navigate(`/results?d=${encoded}`);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-950 text-white">
        <div className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-navy-300 text-sm font-medium tracking-wide uppercase mb-2">
            Next Level Negotiation
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold">
            Offer Analyzer
          </h1>
          <p className="text-navy-200 mt-3 max-w-xl">
            Get a clear, professional read on your job offer — and a
            negotiation strategy tailored to your situation — in under a
            minute.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8"
        >
          {/* Role & company */}
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              About the Role
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Role / Job Title</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.role}
                  onChange={(e) => update("role", e.target.value)}
                  placeholder="e.g. Senior Product Manager"
                />
              </div>
              <div>
                <FieldLabel>Company Name</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <FieldLabel required>Location</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.location}
                  onChange={(e) => update("location", e.target.value)}
                  placeholder="City, State"
                />
              </div>
              <div>
                <FieldLabel required>Industry</FieldLabel>
                <select
                  className={inputClass}
                  value={form.industry}
                  onChange={(e) => update("industry", e.target.value)}
                >
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Compensation */}
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Compensation
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <FieldLabel>Current Salary</FieldLabel>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={form.currentSalary}
                  onChange={(e) => update("currentSalary", e.target.value)}
                  placeholder="Optional — for context only"
                />
              </div>
              <div>
                <FieldLabel required>Offer Base Salary</FieldLabel>
                <input
                  type="number"
                  min="0"
                  className={inputClass}
                  value={form.offerBaseSalary}
                  onChange={(e) => update("offerBaseSalary", e.target.value)}
                  placeholder="e.g. 145000"
                />
              </div>
            </div>

            {/* Bonus */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Does the offer include a bonus?</FieldLabel>
                <ToggleGroup
                  value={form.hasBonus}
                  onChange={(v) => update("hasBonus", v)}
                />
              </div>
              {form.hasBonus && (
                <input
                  type="text"
                  className={inputClass}
                  value={form.bonusAmount}
                  onChange={(e) => update("bonusAmount", e.target.value)}
                  placeholder="Amount or percentage, e.g. $15,000 or 10%"
                />
              )}
            </div>

            {/* Sign-on bonus */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Sign-on bonus?</FieldLabel>
                <ToggleGroup
                  value={form.hasSignOnBonus}
                  onChange={(v) => update("hasSignOnBonus", v)}
                />
              </div>
              {form.hasSignOnBonus && (
                <input
                  type="text"
                  className={inputClass}
                  value={form.signOnBonusAmount}
                  onChange={(e) => update("signOnBonusAmount", e.target.value)}
                  placeholder="e.g. $10,000"
                />
              )}
            </div>

            {/* Equity */}
            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel>Equity?</FieldLabel>
                <ToggleGroup
                  value={form.hasEquity}
                  onChange={(v) => update("hasEquity", v)}
                />
              </div>
              {form.hasEquity && (
                <input
                  type="text"
                  className={inputClass}
                  value={form.equityAmount}
                  onChange={(e) => update("equityAmount", e.target.value)}
                  placeholder="Approximate value or number of shares"
                />
              )}
            </div>
          </section>

          {/* Priorities & leverage */}
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Your Priorities &amp; Leverage
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Top Priority</FieldLabel>
                <select
                  className={inputClass}
                  value={form.topPriority}
                  onChange={(e) => update("topPriority", e.target.value)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>Offer Deadline</FieldLabel>
                <input
                  type="date"
                  className={inputClass}
                  value={form.offerDeadline}
                  onChange={(e) => update("offerDeadline", e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel>
                  Do you have a competing offer or other leverage?
                </FieldLabel>
                <ToggleGroup
                  value={form.hasLeverage}
                  onChange={(v) => update("hasLeverage", v)}
                />
              </div>
              {form.hasLeverage && (
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.leverageDetails}
                  onChange={(e) => update("leverageDetails", e.target.value)}
                  placeholder="Optional — briefly describe your leverage"
                />
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-sm px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-navy-900 hover:bg-navy-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-md px-6 py-3.5 transition shadow-sm"
          >
            {loading ? "Analyzing your offer…" : "Analyze My Offer"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Your information is used only to generate your analysis.
        </p>
      </main>
    </div>
  );
}

function ToggleGroup({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 text-sm font-medium transition ${
          value
            ? "bg-navy-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 text-sm font-medium transition border-l border-slate-300 ${
          !value
            ? "bg-navy-900 text-white"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        No
      </button>
    </div>
  );
}
