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

// Trailing-day presets, matching RANGE_PRESETS in api/admin.js.
const RANGE_PRESETS = [
  ["Today", 1],
  ["7 days", 7],
  ["30 days", 30],
  ["90 days", 90],
  ["120 days", 120],
  ["1 year", 365],
];

const DEFAULT_RANGE = { preset: 7, start: "", end: "" };

// Counters are keyed by UTC day, so day stamps are formatted as UTC too —
// otherwise "2026-09-12" would render as Sept 11 for anyone west of London.
function prettyDay(day) {
  if (!day) return "";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rangeLabel(range) {
  if (!range) return "";
  return range.start === range.end
    ? prettyDay(range.start)
    : `${prettyDay(range.start)} – ${prettyDay(range.end)}`;
}

// One URL builder for both the fetch and the CSV export links, so exports
// always cover exactly the range on screen.
function buildAdminUrl(token, range, extra = {}) {
  const params = new URLSearchParams({ token });
  if (range.preset === "custom") {
    params.set("start", range.start);
    params.set("end", range.end);
  } else {
    params.set("range", String(range.preset));
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/api/admin?${params.toString()}`;
}

function RangeControls({ applied, onApply }) {
  const [showCustom, setShowCustom] = useState(applied.preset === "custom");
  const [start, setStart] = useState(applied.start);
  const [end, setEnd] = useState(applied.end);

  const today = new Date().toISOString().slice(0, 10);
  const dateClass =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map(([label, value]) => {
          const active = applied.preset === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setShowCustom(false);
                onApply({ preset: value, start: "", end: "" });
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition border ${
                active
                  ? "bg-navy-900 border-navy-900 text-white"
                  : "bg-white border-slate-300 text-slate-700 hover:border-navy-600 hover:text-navy-900"
              }`}
            >
              {label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition border ${
            applied.preset === "custom"
              ? "bg-navy-900 border-navy-900 text-white"
              : "bg-white border-slate-300 text-slate-700 hover:border-navy-600 hover:text-navy-900"
          }`}
        >
          Custom…
        </button>
      </div>

      {showCustom && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (start && end) onApply({ preset: "custom", start, end });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="date"
            className={dateClass}
            value={start}
            max={end || today}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start date"
          />
          <span className="text-sm text-slate-400">to</span>
          <input
            type="date"
            className={dateClass}
            value={end}
            min={start || undefined}
            max={today}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End date"
          />
          <button
            type="submit"
            disabled={!start || !end}
            className="rounded-md bg-navy-900 hover:bg-navy-600 disabled:opacity-40 disabled:hover:bg-navy-900 text-white text-sm font-medium px-4 py-1.5 transition"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}

function FunnelSummary({ funnel, range }) {
  if (!funnel) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Funnel
        </h2>
        <span className="text-xs text-slate-400 text-right">
          {rangeLabel(range)}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {FUNNEL_STEPS.map(([key, label]) => (
          <div key={key}>
            <p className="text-lg font-serif font-semibold text-navy-900 leading-none">
              {funnel[key] ?? 0}
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
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [shownRange, setShownRange] = useState(null);
  const [capped, setCapped] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(q = "", activeRange = range) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildAdminUrl(token, activeRange, { q }));
      if (res.status === 401) {
        localStorage.removeItem("nln:adminToken");
        setToken("");
        throw new Error("That token was rejected. Please re-enter it.");
      }
      if (!res.ok) throw new Error("Could not load submissions.");
      const body = await res.json();
      setSubs(body.submissions);
      setFunnel(body.funnel ?? null);
      // The server echoes the range it actually used, which can differ from
      // what was asked for (future end date, over-long span).
      setShownRange(body.range ?? null);
      setCapped(Boolean(body.submissionsCapped));
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
    if (token) load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, range]);

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
              href={buildAdminUrl(token, range, { export: "full" })}
            >
              Export all (CSV)
            </a>
            <a
              className="py-2 font-medium text-navy-600 hover:text-navy-900 transition underline"
              href={buildAdminUrl(token, range, { export: "salary" })}
            >
              Salary data (CSV)
            </a>
          </div>
        </div>

        <RangeControls applied={range} onApply={setRange} />

        <FunnelSummary funnel={funnel} range={shownRange} />

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
          <p className="text-sm text-slate-500">
            No submissions in this date range.
          </p>
        )}
        {!loading && capped && (
          <p className="text-xs text-slate-500">
            Showing the 500 most recent submissions — older ones in this range
            aren't included.
          </p>
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
