import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteHeader from "./SiteHeader.jsx";

// Private lookup page for Alex. Not linked from anywhere in the funnel;
// requires the LEADS_EXPORT_TOKEN to load anything.

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

// Funnel events in order, with short labels for the rollup row.
const FUNNEL_STEPS = [
  ["results_viewed", "Results"],
  ["script_cta_clicked", "Script CTA"],
  ["proof_viewed", "Proof"],
  ["script_checkout_clicked", "Script checkout"],
  ["script_generated", "Script done"],
  ["session_cta_clicked", "Session CTA"],
  ["session_viewed", "Session"],
  ["session_checkout_clicked", "Session checkout"],
  ["booking_confirmed", "Booked"],
];

function FunnelSummary({ funnel }) {
  if (!funnel) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Funnel
        </h2>
        <span className="text-xs text-slate-400">today / last 7 days</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {FUNNEL_STEPS.map(([key, label]) => (
          <div key={key}>
            <p className="text-lg font-serif font-semibold text-navy-900 leading-none">
              {funnel[key]?.today ?? 0}
              <span className="text-sm font-sans font-normal text-slate-400">
                {" "}
                / {funnel[key]?.week ?? 0}
              </span>
            </p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-800 mt-0.5">{String(value)}</dd>
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(
    () => localStorage.getItem("nln:adminToken") || ""
  );
  const [tokenInput, setTokenInput] = useState("");
  const [query, setQuery] = useState("");
  const [subs, setSubs] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(q = "") {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin?token=${encodeURIComponent(token)}${q ? `&q=${encodeURIComponent(q)}` : ""}`
      );
      if (res.status === 401) {
        localStorage.removeItem("nln:adminToken");
        setToken("");
        throw new Error("That token was rejected. Please re-enter it.");
      }
      if (!res.ok) throw new Error("Could not load submissions.");
      const body = await res.json();
      setSubs(body.submissions);
      setFunnel(body.funnel ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function open(id) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin?token=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`
      );
      if (!res.ok) throw new Error("Could not load that submission.");
      setSelected(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen bg-navy-50">
        <SiteHeader />
        <main className="max-w-md mx-auto px-6 py-16">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem("nln:adminToken", tokenInput.trim());
              setToken(tokenInput.trim());
            }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
          >
            <h1 className="text-lg font-serif font-semibold text-navy-900">
              Admin access
            </h1>
            <input
              type="password"
              className={inputClass}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Access token"
            />
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <button
              type="submit"
              className="w-full bg-navy-900 hover:bg-navy-600 text-white font-medium rounded-md px-6 py-3 transition"
            >
              Enter
            </button>
          </form>
        </main>
      </div>
    );
  }

  if (selected) {
    const f = selected.form || {};
    return (
      <div className="min-h-screen bg-navy-50">
        <SiteHeader />
        <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="py-2 text-sm font-medium text-navy-700 hover:text-navy-900 transition"
          >
            ← Back to all submissions
          </button>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h1 className="text-xl font-serif font-semibold text-navy-900 mb-1">
              {f.role} {f.company ? `at ${f.company}` : ""}
            </h1>
            <p className="text-sm text-slate-500 mb-5">
              {selected.email || "no email captured"} ·{" "}
              {new Date(selected.timestamp).toLocaleString()}
            </p>
            <dl className="grid sm:grid-cols-2 gap-4">
              <Field label="Location" value={f.location} />
              <Field label="Industry" value={f.industry} />
              <Field label="Current salary" value={f.currentSalary} />
              <Field label="Offer base salary" value={f.offerBaseSalary} />
              <Field label="Bonus" value={f.hasBonus ? f.bonusAmount : "No"} />
              <Field label="Sign-on" value={f.hasSignOnBonus ? f.signOnBonusAmount : "No"} />
              <Field label="Equity" value={f.hasEquity ? f.equityAmount : "No"} />
              <Field label="Top priority" value={f.topPriority} />
              <Field label="Risk tolerance" value={f.riskTolerance} />
              <Field label="Deadline" value={f.offerDeadline} />
              <Field label="Leverage" value={f.hasLeverage ? f.leverageDetails || "Yes" : "No"} />
            </dl>
            <Field label="Additional context" value={f.additionalContext} />
            {selected.resumeText && (
              <details className="mt-4">
                <summary className="text-sm font-medium text-navy-700 cursor-pointer">
                  Resume (extracted text)
                </summary>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 mt-2 overflow-x-auto">
                  {selected.resumeText}
                </pre>
              </details>
            )}
            {selected.jobDescriptionText && (
              <details className="mt-4">
                <summary className="text-sm font-medium text-navy-700 cursor-pointer">
                  Job description
                </summary>
                <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 mt-2 overflow-x-auto">
                  {selected.jobDescriptionText}
                </pre>
              </details>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-serif font-semibold text-navy-900 mb-3">
              Analysis · Score {selected.analysis?.offerScore}
              {selected.analysis?.internalDataUsed && (
                <span className="ml-2 text-xs font-sans font-semibold uppercase tracking-wide text-navy-600 bg-navy-50 px-2 py-0.5 rounded">
                  used internal data
                </span>
              )}
            </h2>
            {selected.comparablesSummary && (
              <p className="text-sm text-slate-600 mb-3 italic">
                {selected.comparablesSummary}
              </p>
            )}
            <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(selected.analysis, null, 2)}
            </pre>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-serif font-semibold text-navy-900 mb-3">
              Generated Script
            </h2>
            {selected.script ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {selected.script}
              </ReactMarkdown>
            ) : (
              <p className="text-sm text-slate-500">
                No script generated for this submission.
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-serif font-semibold text-navy-900">
            Submissions
          </h1>
          <div className="flex gap-3 text-sm">
            <a
              className="py-2 font-medium text-navy-600 hover:text-navy-900 transition underline"
              href={`/api/admin?token=${encodeURIComponent(token)}&export=full`}
            >
              Export all (CSV)
            </a>
            <a
              className="py-2 font-medium text-navy-600 hover:text-navy-900 transition underline"
              href={`/api/admin?token=${encodeURIComponent(token)}&export=salary`}
            >
              Salary data (CSV)
            </a>
          </div>
        </div>

        <FunnelSummary funnel={funnel} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            load(query);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email, role, company, or location"
          />
          <button
            type="submit"
            className="shrink-0 bg-navy-900 hover:bg-navy-600 text-white font-medium rounded-md px-5 transition"
          >
            Search
          </button>
        </form>

        {error && <p className="text-sm text-rose-700">{error}</p>}
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && subs.length === 0 && (
          <p className="text-sm text-slate-500">No submissions found.</p>
        )}

        <div className="space-y-2">
          {subs.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => open(s.id)}
              className="w-full text-left bg-white rounded-lg border border-slate-200 hover:border-navy-600 shadow-sm px-4 py-3 transition"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium text-navy-900">
                  {s.role || "—"}
                  {s.company ? ` · ${s.company}` : ""}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(s.timestamp).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-slate-600 mt-0.5 flex flex-wrap gap-x-3">
                <span>{s.email || "no email"}</span>
                <span>{s.location}</span>
                {s.offerBaseSalary && <span>${s.offerBaseSalary}</span>}
                {s.hasScript && <span className="text-navy-600 font-medium">script ✓</span>}
                {s.internalDataUsed && <span className="text-slate-400">internal data</span>}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
