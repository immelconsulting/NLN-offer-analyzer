import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { encodeResult } from "../lib/encodeResult.js";
import SiteHeader from "./SiteHeader.jsx";
import icon from "../assets/nln-icon.png";

const INDUSTRIES = [
  "Tech",
  "Sales",
  "Marketing",
  "Consulting",
  "Operations",
  "Data/Analytics",
  "Finance",
  "Legal",
  "Healthcare",
  "Government",
  "Nonprofit",
  "Education",
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

const RISK_OPTIONS = [
  {
    value: "Cautious",
    label: "Cautious",
    description: "I don't want to risk the offer",
  },
  {
    value: "Balanced",
    label: "Balanced",
    description: "Some risk is fine",
  },
  {
    value: "Aggressive",
    label: "Aggressive",
    description: "I want to push hard",
  },
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
  riskTolerance: "",
  additionalContext: "",
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
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

// "145000" -> "145,000". Digits only — for the salary fields.
function formatSalary(value) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Adds thousands separators to any number typed inside free text,
// preserving symbols like $ and % and decimal parts:
// "$15000" -> "$15,000", "10%" -> "10%", "1234.56" -> "1,234.56"
function formatNumbersInText(value) {
  return value.replace(/\d[\d,]*(?:\.\d*)?/g, (match) => {
    const [intPart, decPart] = match.split(".");
    const grouped = intPart
      .replace(/,/g, "")
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  });
}

export default function OfferForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  // Optional context uploads live outside `form` so they never end up in
  // the URL-encoded results — only their extracted text is used server-side.
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!form.role.trim()) return "Role / job title is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.offerBaseSalary || Number(form.offerBaseSalary.replace(/,/g, "")) <= 0)
      return "Offer base salary is required.";
    if (form.hasBonus && !form.bonusAmount.trim())
      return "Please provide the bonus amount or percentage.";
    if (form.hasSignOnBonus && !form.signOnBonusAmount.trim())
      return "Please provide the sign-on bonus amount.";
    if (form.hasEquity && !form.equityAmount.trim())
      return "Please provide the approximate equity value or shares.";
    if (!form.riskTolerance)
      return "Please choose how much risk you're comfortable with.";
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
      // Attach the email captured on the landing page (if any) so the
      // submission can be stored under it — invisible to the user.
      let leadEmail = "";
      try {
        leadEmail = JSON.parse(sessionStorage.getItem("nln:lead"))?.email || "";
      } catch {
        // no lead in this session — store anonymously
      }
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          leadEmail,
          resumeFile,
          jobDescriptionFile,
          jobDescriptionText,
        }),
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
    <div className="min-h-screen bg-navy-50">
      {loading && <LoadingOverlay />}
      <SiteHeader />
      <header>
        <div className="max-w-3xl mx-auto px-6 pt-10 pb-2">
          <h1 className="text-3xl sm:text-4xl font-serif font-semibold text-navy-950">
            Offer Analyzer
          </h1>
          <p className="text-slate-700 mt-4 max-w-xl">
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
                <SalaryInput
                  value={form.currentSalary}
                  onChange={(v) => update("currentSalary", v)}
                  placeholder="Optional — for context only"
                />
              </div>
              <div>
                <FieldLabel required>Offer Base Salary</FieldLabel>
                <SalaryInput
                  value={form.offerBaseSalary}
                  onChange={(v) => update("offerBaseSalary", v)}
                  placeholder="e.g. 145,000"
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
                  onChange={(e) => update("bonusAmount", formatNumbersInText(e.target.value))}
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
                  onChange={(e) => update("signOnBonusAmount", formatNumbersInText(e.target.value))}
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
                  onChange={(e) => update("equityAmount", formatNumbersInText(e.target.value))}
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

            <div>
              <FieldLabel required>
                How much risk are you comfortable with in this negotiation?
              </FieldLabel>
              <div className="grid sm:grid-cols-3 gap-3">
                {RISK_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update("riskTolerance", r.value)}
                    className={`text-left rounded-lg border p-4 transition ${
                      form.riskTolerance === r.value
                        ? "border-navy-600 ring-1 ring-navy-600 bg-navy-50"
                        : "border-slate-300 bg-white hover:border-navy-300"
                    }`}
                  >
                    <span className="block font-medium text-navy-900">
                      {r.label}
                    </span>
                    <span className="block text-sm text-slate-600 mt-0.5">
                      {r.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-slate-500 mt-1.5">
                We'll use this to recommend the right strategy for you.
              </p>
            </div>

            <div>
              <FieldLabel>Anything else we should know?</FieldLabel>
              <textarea
                className={inputClass}
                rows={4}
                value={form.additionalContext}
                onChange={(e) => update("additionalContext", e.target.value)}
                placeholder="Optional — notes from your conversations with the recruiter, what you're targeting, research you've already done, or anything else that feels relevant."
              />
            </div>
          </section>

          {/* Optional context uploads */}
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Extra Context <span className="text-sm font-sans font-normal text-slate-500">(optional)</span>
            </h2>
            <p className="text-sm text-slate-500 -mt-2">
              These are used only to add context to your analysis and script —
              nothing here is required.
            </p>

            <div>
              <FieldLabel>Your resume</FieldLabel>
              <FileUpload
                file={resumeFile}
                onChange={setResumeFile}
                onError={setError}
              />
              <p className="text-sm text-slate-500 mt-1.5">
                Helps tailor your value framing to your actual background.
              </p>
            </div>

            <div>
              <FieldLabel>Job description</FieldLabel>
              <textarea
                className={inputClass}
                rows={4}
                value={jobDescriptionText}
                onChange={(e) => setJobDescriptionText(e.target.value)}
                placeholder="Paste the job description here…"
              />
              <div className="mt-2">
                <FileUpload
                  file={jobDescriptionFile}
                  onChange={setJobDescriptionFile}
                  onError={setError}
                  label="…or upload it as a file"
                />
              </div>
              <p className="text-sm text-slate-500 mt-1.5">
                Pasting works best — links to job boards often can't be read,
                so copy the text instead.
              </p>
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
            className="w-full bg-navy-900 hover:bg-navy-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-md px-6 py-3.5 transition shadow-sm"
          >
            {loading ? "Analyzing your offer…" : "Analyze My Offer"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          This tool uses AI, guided by NLN's negotiation methodology, to
          generate your offer analysis and script.
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          Your submission is saved so our team can prepare if you book a
          coaching call, and anonymized, aggregated compensation data may help
          inform other users' analyses.
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          Questions? Reach out at{" "}
          <a
            href="mailto:alex@nextlevelnegotiation.com"
            className="font-medium text-navy-600 hover:text-navy-900 transition"
          >
            alex@nextlevelnegotiation.com
          </a>
        </p>
      </main>
    </div>
  );
}

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center px-6 text-center">
      <img src={icon} alt="NLN" className="h-14 w-auto animate-pulse mb-8" />
      <div className="h-10 w-10 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin mb-6" />
      <p className="text-xl font-serif font-semibold text-navy-900">
        Analyzing your offer…
      </p>
      <p className="text-slate-600 text-sm mt-2 max-w-xs">
        We're reviewing your compensation details and building your
        negotiation strategy. This usually takes 15–30 seconds.
      </p>
    </div>
  );
}

const UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const UPLOAD_ACCEPT = ".pdf,.docx,.txt";

// Optional-context file picker. Reads the file into base64 in the browser
// and hands back { name, type, data } — the server extracts the text.
function FileUpload({ file, onChange, onError, label }) {
  function handlePick(e) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!picked) return;
    const name = picked.name.toLowerCase();
    if (!/\.(pdf|docx|txt)$/.test(name)) {
      onError("Please upload a PDF, Word (.docx), or plain text (.txt) file.");
      return;
    }
    if (picked.size > UPLOAD_MAX_BYTES) {
      onError("That file is over 2MB — please upload a smaller version.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] || "";
      onChange({ name: picked.name, type: picked.type, data: base64 });
      onError("");
    };
    reader.onerror = () => onError("We couldn't read that file — please try again.");
    reader.readAsDataURL(picked);
  }

  if (file) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-navy-200 bg-navy-50 px-3 py-2.5">
        <span className="text-sm text-navy-900 truncate">📄 {file.name}</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="shrink-0 text-sm font-medium text-slate-500 hover:text-rose-600 transition py-1 px-2"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <label className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-3 py-2.5 cursor-pointer hover:border-navy-400 transition">
      <span className="text-sm text-slate-600">
        {label || "Upload a file"}{" "}
        <span className="text-slate-400">(PDF, Word, or .txt — max 2MB)</span>
      </span>
      <input
        type="file"
        accept={UPLOAD_ACCEPT}
        onChange={handlePick}
        className="sr-only"
      />
    </label>
  );
}

// Salary field with a purely visual "$" prefix once a value is entered —
// the stored value stays digits + commas, so nothing downstream changes.
function SalaryInput({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      {value && (
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          aria-hidden="true"
        >
          $
        </span>
      )}
      <input
        type="text"
        inputMode="numeric"
        className={`${inputClass} ${value ? "!pl-7" : ""}`}
        value={value}
        onChange={(e) => onChange(formatSalary(e.target.value))}
        placeholder={placeholder}
      />
    </div>
  );
}

function ToggleGroup({ value, onChange }) {
  return (
    <div className="inline-flex rounded-md border border-slate-300 overflow-hidden shrink-0">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2.5 text-sm font-medium transition ${
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
        className={`px-4 py-2.5 text-sm font-medium transition border-l border-slate-300 ${
          !value
            ? "bg-slate-200 text-slate-700"
            : "bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        No
      </button>
    </div>
  );
}
