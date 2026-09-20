import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { encodeResult } from "../lib/encodeResult.js";
import SiteHeader from "./SiteHeader.jsx";
import { CONTACT_EMAIL } from "../lib/config.js";
import icon from "../assets/nln-icon.png";

// Applying-stage form. Deliberately much shorter than OfferForm — people at
// this stage have no offer numbers to enter, and a long form here would cost
// more completions than the extra context is worth.

const EXPERIENCE_BANDS = ["0-2", "3-5", "6-9", "10-15", "15+"];

// Same component and copy as the offer form, so the question reads
// identically in both flows.
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

const SALARY_STAGES = [
  { value: "no_call", label: "No recruiter call yet" },
  { value: "call_scheduled", label: "A call is scheduled or coming up" },
  { value: "dodged", label: "A recruiter asked and I dodged it" },
  { value: "gave_number", label: "I already gave a number" },
];

const initialState = {
  targetRole: "",
  targetCompany: "",
  location: "",
  yearsExperience: "",
  riskTolerance: "",
  salaryStage: "",
  sharedNumber: "",
  currentSalary: "",
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

export default function ApplyForm() {
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
    if (!form.targetRole.trim()) return "Target role is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.yearsExperience) return "Please select your years of experience.";
    if (!form.salaryStage)
      return "Please tell us where you are with the salary question.";
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
      const res = await fetch("/api/analyze-apply", {
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
        throw new Error(body.error || "Something went wrong building your range.");
      }
      const analysis = await res.json();
      // flow rides inside the encoded payload so the results, proof, and
      // script pages all know which path they're on.
      const encoded = encodeResult({ flow: "apply", form, analysis });
      navigate(`/apply/results?d=${encoded}`);
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
            Know Your Number
          </h1>
          <p className="text-slate-700 mt-4 max-w-xl">
            Before a recruiter asks what you're looking for, know exactly what
            to say. Answer five quick questions and we'll research your market
            rate.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8"
        >
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              The Role You're Targeting
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Target Role / Job Title</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.targetRole}
                  onChange={(e) => update("targetRole", e.target.value)}
                  placeholder="e.g. Senior Product Manager"
                />
              </div>
              <div>
                <FieldLabel>Target Company</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.targetCompany}
                  onChange={(e) => update("targetCompany", e.target.value)}
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
                  placeholder='City, State or "Remote"'
                />
              </div>
              <div>
                <FieldLabel required>Years of Experience</FieldLabel>
                <select
                  className={inputClass}
                  value={form.yearsExperience}
                  onChange={(e) => update("yearsExperience", e.target.value)}
                >
                  <option value="">Select…</option>
                  {EXPERIENCE_BANDS.map((b) => (
                    <option key={b} value={b}>
                      {b} years
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Where You Are Right Now
            </h2>

            <div>
              <FieldLabel required>
                Where are you with the salary question?
              </FieldLabel>
              <select
                className={inputClass}
                value={form.salaryStage}
                onChange={(e) => update("salaryStage", e.target.value)}
              >
                <option value="">Select…</option>
                {SALARY_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {form.salaryStage === "gave_number" && (
                <div className="mt-4">
                  <FieldLabel>What number did you share?</FieldLabel>
                  <SalaryInput
                    value={form.sharedNumber}
                    onChange={(v) => update("sharedNumber", v)}
                    placeholder="Optional — helps us write your recovery script"
                  />
                  <p className="text-sm text-slate-500 mt-1.5">
                    Giving a number early is common and recoverable. Knowing it
                    lets us write the exact language to reset the conversation.
                  </p>
                </div>
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
              <FieldLabel>Current Base Salary</FieldLabel>
              <SalaryInput
                value={form.currentSalary}
                onChange={(v) => update("currentSalary", v)}
                placeholder="Optional"
              />
              <p className="text-sm text-slate-500 mt-1.5">
                Used only to sanity-check your range. It is never put in your
                script, and you should never share it with a recruiter.
              </p>
            </div>

            <div>
              <FieldLabel>Anything else we should know?</FieldLabel>
              <textarea
                className={inputClass}
                rows={4}
                value={form.additionalContext}
                onChange={(e) => update("additionalContext", e.target.value)}
                placeholder="Optional — what you're targeting, how the search is going, anything a recruiter has already said to you, or anything else that feels relevant."
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
                Helps place you accurately within the experience band.
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
            {loading ? "Researching your market rate…" : "Find My Number"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          This tool uses AI, guided by NLN's negotiation methodology, to
          research your range and generate your script.
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          Your submission is saved so our team can prepare if you book a
          coaching call.
        </p>
        <p className="text-center text-sm text-slate-500 mt-2">
          Questions? Reach out at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="font-medium text-navy-600 hover:text-navy-900 transition"
          >
            {CONTACT_EMAIL}
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
        Researching your market rate…
      </p>
      <p className="text-slate-600 text-sm mt-2 max-w-xs">
        We're pulling current compensation data for your role and location,
        then building your target range. This takes up to two minutes — worth
        the wait for real numbers.
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
