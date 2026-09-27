import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { encodeResult } from "../lib/encodeResult.js";
import { loadDraft, saveDraft, withDraft } from "../lib/formDraft.js";
import { getFlow } from "../lib/flows.js";
import SiteHeader from "./SiteHeader.jsx";
import { CONTACT_EMAIL } from "../lib/config.js";
import icon from "../assets/nln-icon.png";

// Expecting-an-offer-soon form. Field names match ApplyForm wherever the
// question is the same, so formDraft.js prefill carries across flows.
//
// Company is required here, unlike the screening-call form: at this stage the
// candidate knows exactly who is calling, and naming the company lets the
// analyzer spend one of its three searches on company-specific pay data.

const EXPERIENCE_BANDS = ["0-2", "3-5", "6-9", "10-15", "15+"];

// Same component and copy as the other forms, so the question reads
// identically everywhere.
const RISK_OPTIONS = [
  {
    value: "Cautious",
    label: "Cautious",
    description: "I don't want to risk the offer",
  },
  { value: "Balanced", label: "Balanced", description: "Some risk is fine" },
  {
    value: "Aggressive",
    label: "Aggressive",
    description: "I want to push hard",
  },
];

const COMP_STATUSES = [
  { value: "not_discussed", label: "We haven't talked numbers yet" },
  { value: "recruiter_shared_range", label: "The recruiter shared a range" },
  { value: "i_shared_number", label: "I already shared a number or range" },
  { value: "both_shared", label: "We've both shared numbers" },
];

const OTHER_PROCESSES = [
  { value: "none", label: "No, this is my only active process" },
  { value: "interviewing_elsewhere", label: "I'm interviewing elsewhere" },
  {
    value: "expecting_offer",
    label: "I expect another offer in the next 1-2 weeks",
  },
  { value: "have_offer", label: "I already have another offer" },
];

const CALL_TIMINGS = [
  { value: "scheduled", label: "It's scheduled" },
  { value: "any_day", label: "Any day now" },
  { value: "not_sure", label: "Not sure yet" },
];

const PRIORITY_OPTIONS = [
  "Remote or hybrid",
  "Start date",
  "Title",
  "Sign-on bonus",
  "Equity",
  "Annual bonus",
  "PTO",
  "Growth path",
];

// Which comp-status answers reveal which conditional field.
const SHOWS_RECRUITER_RANGE = ["recruiter_shared_range", "both_shared"];
const SHOWS_SHARED_NUMBER = ["i_shared_number", "both_shared"];
const SHOWS_OTHER_COMP = ["expecting_offer", "have_offer"];

const initialState = {
  targetRole: "",
  targetCompany: "",
  location: "",
  yearsExperience: "",
  riskTolerance: "",
  compStatus: "",
  recruiterRangeLow: "",
  recruiterRangeHigh: "",
  sharedNumber: "",
  otherProcesses: "",
  otherCompExpected: "",
  callTiming: "",
  currentTotalComp: "",
  additionalContext: "",
};

// Fields this form shares with the offer form under a different name.
const DRAFT_ALIASES = {
  targetRole: "role",
  targetCompany: "company",
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

export default function OfferSoonForm() {
  const navigate = useNavigate();
  const stage = getFlow("offer_soon");
  const [form, setForm] = useState(() => withDraft(initialState, DRAFT_ALIASES));
  // Priorities are a multi-select, so they live outside the string-only draft.
  const [priorities, setPriorities] = useState([]);
  // Optional context uploads live outside `form` so they never end up in the
  // URL-encoded results — only their extracted text is used server-side.
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescriptionFile, setJobDescriptionFile] = useState(null);
  const [jobDescriptionText, setJobDescriptionText] = useState(
    () => loadDraft().jobDescriptionText || ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    saveDraft({ [field]: value });
  }

  function updateJobDescription(value) {
    setJobDescriptionText(value);
    saveDraft({ jobDescriptionText: value });
  }

  function togglePriority(value) {
    setPriorities((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  function validate() {
    if (!form.targetRole.trim()) return "Target role is required.";
    if (!form.targetCompany.trim()) return "Company is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.yearsExperience) return "Please select your years of experience.";
    if (!form.compStatus)
      return "Please tell us where things stand on compensation.";
    if (!form.otherProcesses)
      return "Please tell us whether you have other opportunities in play.";
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
      const payload = { ...form, priorities };
      const res = await fetch("/api/analyze-offer-soon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
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
      const encoded = encodeResult({
        flow: "offer_soon",
        form: payload,
        analysis,
      });
      navigate(`${stage.resultsPath}?d=${encoded}`);
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
            Be Ready for the Offer Call
          </h1>
          <p className="text-slate-700 mt-4 max-w-xl">{stage.formIntro}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-8"
        >
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              The Role
            </h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <FieldLabel required>Role / Job Title</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.targetRole}
                  onChange={(e) => update("targetRole", e.target.value)}
                  placeholder="e.g. Senior Product Manager"
                />
              </div>
              <div>
                <FieldLabel required>Company</FieldLabel>
                <input
                  type="text"
                  className={inputClass}
                  value={form.targetCompany}
                  onChange={(e) => update("targetCompany", e.target.value)}
                  placeholder="Who's making the offer?"
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
            <p className="text-sm text-slate-500">
              Naming the company lets us research what they actually pay for
              this role, not just the broader market.
            </p>
          </section>

          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Where Things Stand
            </h2>

            <div>
              <FieldLabel required>
                Where do things stand on compensation so far?
              </FieldLabel>
              <select
                className={inputClass}
                value={form.compStatus}
                onChange={(e) => update("compStatus", e.target.value)}
              >
                <option value="">Select…</option>
                {COMP_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              {SHOWS_RECRUITER_RANGE.includes(form.compStatus) && (
                <div className="mt-4">
                  <FieldLabel>What range did they share?</FieldLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <SalaryInput
                      value={form.recruiterRangeLow}
                      onChange={(v) => update("recruiterRangeLow", v)}
                      placeholder="Low"
                    />
                    <SalaryInput
                      value={form.recruiterRangeHigh}
                      onChange={(v) => update("recruiterRangeHigh", v)}
                      placeholder="High"
                    />
                  </div>
                  <p className="text-sm text-slate-500 mt-1.5">
                    Optional. We'll compare their band to the market so you know
                    whether it's a fair opening or a low one.
                  </p>
                </div>
              )}

              {SHOWS_SHARED_NUMBER.includes(form.compStatus) && (
                <div className="mt-4">
                  <FieldLabel>What did you share?</FieldLabel>
                  <input
                    type="text"
                    className={inputClass}
                    value={form.sharedNumber}
                    onChange={(e) => update("sharedNumber", e.target.value)}
                    placeholder='Optional — e.g. "around $140k" or "$130k to $150k"'
                  />
                  <p className="text-sm text-slate-500 mt-1.5">
                    Sharing a number early is common and recoverable. Knowing it
                    lets us write the language to revisit it later.
                  </p>
                </div>
              )}
            </div>

            <div>
              <FieldLabel required>Any other opportunities in play?</FieldLabel>
              <select
                className={inputClass}
                value={form.otherProcesses}
                onChange={(e) => update("otherProcesses", e.target.value)}
              >
                <option value="">Select…</option>
                {OTHER_PROCESSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-sm text-slate-500 mt-1.5">
                We only ever write lines about opportunities you actually have.
                If this is your only process, your script says nothing about
                competing offers.
              </p>

              {SHOWS_OTHER_COMP.includes(form.otherProcesses) && (
                <div className="mt-4">
                  <FieldLabel>
                    Roughly what total comp do you expect there?
                  </FieldLabel>
                  <SalaryInput
                    value={form.otherCompExpected}
                    onChange={(v) => update("otherCompExpected", v)}
                    placeholder="Optional"
                  />
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
              <FieldLabel>When do you expect the offer call?</FieldLabel>
              <select
                className={inputClass}
                value={form.callTiming}
                onChange={(e) => update("callTiming", e.target.value)}
              >
                <option value="">Optional — select…</option>
                {CALL_TIMINGS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>What matters beyond base salary?</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const active = priorities.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePriority(p)}
                      aria-pressed={active}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition border ${
                        active
                          ? "bg-navy-900 border-navy-900 text-white"
                          : "bg-white border-slate-300 text-slate-700 hover:border-navy-600 hover:text-navy-900"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-slate-500 mt-1.5">
                Optional. Pick any that apply, and we'll prioritize the
                questions you ask on the call around them.
              </p>
            </div>

            <div>
              <FieldLabel>Current Total Annual Compensation</FieldLabel>
              <SalaryInput
                value={form.currentTotalComp}
                onChange={(v) => update("currentTotalComp", v)}
                placeholder="Optional"
              />
              <p className="text-sm text-slate-500 mt-1.5">
                Everything you earn in a year combined: base, bonuses,
                commission, and the annual value of any equity. Used only to
                sanity-check your range. It is never put in your script, and you
                should never share it with a recruiter.
              </p>
            </div>

            <div>
              <FieldLabel>Anything else we should know?</FieldLabel>
              <textarea
                className={inputClass}
                rows={4}
                value={form.additionalContext}
                onChange={(e) => update("additionalContext", e.target.value)}
                placeholder="Optional — how the interviews went, anything the recruiter has said, your timeline, or anything else that feels relevant."
              />
            </div>
          </section>

          {/* Optional context uploads */}
          <section className="space-y-5">
            <h2 className="text-lg font-serif font-semibold text-navy-900 border-b border-slate-200 pb-2">
              Extra Context{" "}
              <span className="text-sm font-sans font-normal text-slate-500">
                (optional)
              </span>
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
              <FieldLabel>Job Description</FieldLabel>
              <textarea
                className={inputClass}
                rows={4}
                value={jobDescriptionText}
                onChange={(e) => updateJobDescription(e.target.value)}
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
                The posting for the role you're interviewing for. Pasting works
                best, since links to job boards often can't be read.
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
            {loading ? "Researching your market rate…" : "Show Me My Range"}
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
        We're pulling current compensation data for this role and company, then
        building what a strong offer looks like. This takes up to two minutes —
        worth the wait for real numbers.
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
    reader.onerror = () =>
      onError("We couldn't read that file — please try again.");
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
