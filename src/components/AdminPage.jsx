import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteHeader from "./SiteHeader.jsx";

// Private lookup page for Alex. Not linked from anywhere in the funnel, and
// gated by a password that's exchanged for an httpOnly session cookie — the
// secret never rides in a URL.

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

// The funnel isn't one straight line — results branch into the self-serve
// script and the paid strategy session — so it's modelled as a shared top
// with two independent paths.
const FUNNEL_TOP = { key: "results_viewed", label: "Results viewed" };

const FUNNEL_BRANCHES = [
  {
    name: "Script path",
    note: "$47 self-serve counter-offer script",
    steps: [
      { key: "script_cta_clicked", label: "Script CTA clicked" },
      { key: "proof_viewed", label: "Proof page viewed" },
      { key: "script_checkout_clicked", label: "Checkout clicked" },
      { key: "script_generated", label: "Script delivered" },
    ],
  },
  {
    name: "Strategy session path",
    note: "$199 / $329 paid session",
    steps: [
      { key: "session_cta_clicked", label: "Session CTA clicked" },
      { key: "session_viewed", label: "Session page viewed" },
      { key: "session_checkout_clicked", label: "Checkout clicked" },
      { key: "booking_confirmed", label: "Booking confirmed" },
    ],
  },
];

// Short windows stay in days; longer ones are calendar months. Ids match
// RANGE_PRESETS in api/admin.js.
const RANGE_PRESETS = [
  ["Today", "1d"],
  ["7 days", "7d"],
  ["30 days", "30d"],
  ["3 months", "3m"],
  ["4 months", "4m"],
  ["6 months", "6m"],
  ["1 year", "12m"],
];

const DEFAULT_RANGE = { preset: "7d", start: "", end: "" };

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

// A percentage is only meaningful with a non-zero denominator.
function pct(part, whole) {
  if (!whole) return null;
  return (part / whole) * 100;
}

function formatPct(value) {
  if (value === null) return "—";
  if (value > 0 && value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

// One URL builder for both the fetch and the CSV export links, so exports
// always cover exactly the range on screen. Auth rides on the cookie.
function buildAdminUrl(range, extra = {}) {
  const params = new URLSearchParams();
  if (range.preset === "custom") {
    params.set("start", range.start);
    params.set("end", range.end);
  } else {
    params.set("range", range.preset);
  }
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/api/admin?${params.toString()}`;
}

function LoginForm({ onSuccess, notice }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice || "");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not sign in.");
      setPassword("");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy-50">
      <SiteHeader />
      <main className="max-w-md mx-auto px-6 py-16">
        <form
          onSubmit={submit}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4"
        >
          <div>
            <h1 className="text-lg font-serif font-semibold text-navy-900">
              Admin sign in
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              This page holds submitter data. Sign in to continue.
            </p>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
          />
          {error && <p className="text-sm text-rose-700">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full bg-navy-900 hover:bg-navy-600 disabled:opacity-40 text-white font-medium rounded-md px-6 py-3 transition"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </main>
    </div>
  );
}

function RangeControls({ applied, onApply }) {
  const [showCustom, setShowCustom] = useState(applied.preset === "custom");
  const [start, setStart] = useState(applied.start);
  const [end, setEnd] = useState(applied.end);

  const today = new Date().toISOString().slice(0, 10);
  const dateClass =
    "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600 transition";

  const chip = (active) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition border ${
      active
        ? "bg-navy-900 border-navy-900 text-white"
        : "bg-white border-slate-300 text-slate-700 hover:border-navy-600 hover:text-navy-900"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RANGE_PRESETS.map(([label, value]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setShowCustom(false);
              onApply({ preset: value, start: "", end: "" });
            }}
            className={chip(applied.preset === value)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className={chip(applied.preset === "custom")}
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

// One step of the funnel: a proportional bar plus the raw count and both
// percentages (share of everyone who reached results, and share of the step
// immediately before it).
function FunnelBar({ label, count, top, previous, tone = "bar" }) {
  const share = pct(count, top);
  const step = previous === null ? null : pct(count, previous);
  const width = share === null ? 0 : Math.min(share, 100);

  const barColor = tone === "top" ? "bg-navy-900" : "bg-navy-600";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-sm text-slate-700">{label}</span>
        <span className="text-sm font-semibold text-navy-900 tabular-nums">
          {count.toLocaleString()}
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="flex justify-between gap-2 mt-1">
        <span className="text-xs text-slate-500">
          {formatPct(share)} of results
        </span>
        {step !== null && (
          <span className="text-xs text-slate-400">
            {formatPct(step)} of previous step
          </span>
        )}
      </div>
    </div>
  );
}

function FunnelVisual({ funnel, range }) {
  if (!funnel) return null;

  const top = funnel[FUNNEL_TOP.key] ?? 0;
  const empty = Object.values(funnel).every((v) => !v);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Funnel
        </h2>
        <span className="text-xs text-slate-400">{rangeLabel(range)}</span>
      </div>

      {empty ? (
        <p className="text-sm text-slate-500">
          No tracked activity in this date range.
        </p>
      ) : (
        <>
          <div className="mb-6">
            <FunnelBar
              label={FUNNEL_TOP.label}
              count={top}
              top={top}
              previous={null}
              tone="top"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {FUNNEL_BRANCHES.map((branch) => (
              <div key={branch.name}>
                <div className="mb-3 pb-2 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-navy-900">
                    {branch.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{branch.note}</p>
                </div>
                <div className="space-y-4">
                  {branch.steps.map((step, i) => (
                    <FunnelBar
                      key={step.key}
                      label={step.label}
                      count={funnel[step.key] ?? 0}
                      top={top}
                      previous={
                        i === 0 ? top : funnel[branch.steps[i - 1].key] ?? 0
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400 mt-6 leading-relaxed">
            Bars are scaled against results viewed. The session page is also
            reachable from the thank-you pages and the post-script upsell, so
            its step percentage can exceed 100%.
          </p>
        </>
      )}
    </div>
  );
}

// Spreadsheet view. Columns are sortable; clicking a row opens the full
// record.
const COLUMNS = [
  { key: "timestamp", label: "Date", type: "date" },
  { key: "email", label: "Email", type: "text" },
  { key: "role", label: "Role", type: "text" },
  { key: "company", label: "Company", type: "text" },
  { key: "location", label: "Location", type: "text" },
  { key: "industry", label: "Industry", type: "text" },
  { key: "offerBaseSalary", label: "Base salary", type: "number" },
  { key: "offerScore", label: "Score", type: "number" },
  { key: "topPriority", label: "Priority", type: "text" },
  { key: "riskTolerance", label: "Risk", type: "text" },
  { key: "resumeChars", label: "Resume", type: "flag" },
  { key: "jobDescriptionChars", label: "JD", type: "flag" },
  { key: "hasScript", label: "Script", type: "flag" },
];

// Salaries arrive as display strings ("180,000"), so strip everything that
// isn't a digit before comparing.
function numeric(value) {
  const n = Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function sortSubmissions(rows, sort) {
  if (!sort.key) return rows;
  const column = COLUMNS.find((c) => c.key === sort.key);
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (column?.type === "number") return (numeric(av) - numeric(bv)) * dir;
    if (column?.type === "flag") return ((av ? 1 : 0) - (bv ? 1 : 0)) * dir;
    if (column?.type === "date") {
      return (new Date(av).getTime() - new Date(bv).getTime()) * dir;
    }
    return String(av ?? "").localeCompare(String(bv ?? "")) * dir;
  });
}

function SubmissionsTable({ rows, sort, onSort, onOpen }) {
  const cell = "px-3 py-2 whitespace-nowrap text-sm border-b border-slate-100";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead className="bg-navy-50">
            <tr>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className="px-3 py-2 text-left whitespace-nowrap border-b border-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`text-xs font-semibold uppercase tracking-wide transition ${
                        active
                          ? "text-navy-900"
                          : "text-slate-500 hover:text-navy-900"
                      }`}
                    >
                      {col.label}
                      <span className="ml-1 text-[10px]">
                        {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                onClick={() => onOpen(s.id)}
                className="cursor-pointer hover:bg-navy-50/60 transition"
              >
                <td className={`${cell} text-slate-500`}>
                  {new Date(s.timestamp).toLocaleDateString()}
                </td>
                <td className={`${cell} text-navy-900 font-medium`}>
                  {s.email || "—"}
                </td>
                <td className={`${cell} text-slate-700`}>{s.role || "—"}</td>
                <td className={`${cell} text-slate-700`}>{s.company || "—"}</td>
                <td className={`${cell} text-slate-700`}>{s.location || "—"}</td>
                <td className={`${cell} text-slate-700`}>{s.industry || "—"}</td>
                <td className={`${cell} text-slate-700 tabular-nums`}>
                  {s.offerBaseSalary ? `$${s.offerBaseSalary}` : "—"}
                </td>
                <td className={`${cell} text-slate-700 tabular-nums`}>
                  {s.offerScore ?? "—"}
                </td>
                <td className={`${cell} text-slate-700`}>
                  {s.topPriority || "—"}
                </td>
                <td className={`${cell} text-slate-700`}>
                  {s.riskTolerance || "—"}
                </td>
                <td className={cell}>
                  {s.resumeChars ? (
                    <span className="text-navy-600 font-medium">✓</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={cell}>
                  {s.jobDescriptionChars ? (
                    <span className="text-navy-600 font-medium">✓</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className={cell}>
                  {s.hasScript ? (
                    <span className="text-navy-600 font-medium">✓</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

// Uploaded files are never stored — api/analyze.js keeps only the extracted
// text — so this shows the text that was actually read out of the document
// and fed to the model.
function DocumentPanel({ title, text }) {
  if (!text) return null;
  const words = text.trim().split(/\s+/).length;
  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
        <span className="text-xs text-slate-400">
          {words.toLocaleString()} words · extracted text
        </span>
      </div>
      <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
        {text}
      </pre>
    </div>
  );
}

export default function AdminPage() {
  // null = still checking the session, false = show login, true = signed in
  const [authed, setAuthed] = useState(null);
  const [query, setQuery] = useState("");
  const [subs, setSubs] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [shownRange, setShownRange] = useState(null);
  const [capped, setCapped] = useState(false);
  const [sort, setSort] = useState({ key: "timestamp", dir: "desc" });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(q = "", activeRange = range) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(buildAdminUrl(activeRange, { q }));
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Could not load submissions.");
      const body = await res.json();
      setSubs(body.submissions);
      setFunnel(body.funnel ?? null);
      // The server echoes the range it actually used, which can differ from
      // what was asked for (future end date, over-long span).
      setShownRange(body.range ?? null);
      setCapped(Boolean(body.submissionsCapped));
      setAuthed(true);
    } catch (err) {
      setError(err.message);
      // A failure before we've ever loaded (server down, bad response) would
      // otherwise leave the page stuck on "Checking your session…" with the
      // error hidden. Fall through to the login screen, which surfaces it.
      setAuthed((current) => (current === null ? false : current));
    } finally {
      setLoading(false);
    }
  }

  async function open(id) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin?id=${encodeURIComponent(id)}`);
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) throw new Error("Could not load that submission.");
      setSelected(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logout: true }),
      });
    } catch {
      /* clearing local state is what matters */
    }
    setSubs([]);
    setFunnel(null);
    setSelected(null);
    setAuthed(false);
  }

  // An existing cookie means this succeeds and skips the login screen.
  useEffect(() => {
    load(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "timestamp" ? "desc" : "asc" }
    );
  }

  const sorted = useMemo(() => sortSubmissions(subs, sort), [subs, sort]);

  if (authed === null) {
    return (
      <div className="min-h-screen bg-navy-50">
        <SiteHeader />
        <main className="max-w-md mx-auto px-6 py-16 text-center">
          <p className="text-sm text-slate-500">Checking your session…</p>
        </main>
      </div>
    );
  }

  if (authed === false) {
    return <LoginForm notice={error} onSuccess={() => load(query)} />;
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
            {f.additionalContext && (
              <div className="mt-4">
                <Field label="Additional context" value={f.additionalContext} />
              </div>
            )}

            <DocumentPanel title="Resume" text={selected.resumeText} />
            <DocumentPanel
              title="Job description"
              text={selected.jobDescriptionText}
            />
            {!selected.resumeText && !selected.jobDescriptionText && (
              <p className="text-sm text-slate-500 mt-5">
                No resume or job description was attached to this submission.
              </p>
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
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-serif font-semibold text-navy-900">
            Submissions
          </h1>
          <div className="flex items-center gap-3 text-sm">
            <a
              className="py-2 font-medium text-navy-600 hover:text-navy-900 transition underline"
              href={buildAdminUrl(range, { export: "full" })}
            >
              Export all (CSV)
            </a>
            <a
              className="py-2 font-medium text-navy-600 hover:text-navy-900 transition underline"
              href={buildAdminUrl(range, { export: "salary" })}
            >
              Salary data (CSV)
            </a>
            <button
              type="button"
              onClick={logout}
              className="py-2 font-medium text-slate-500 hover:text-navy-900 transition"
            >
              Sign out
            </button>
          </div>
        </div>

        <RangeControls applied={range} onApply={setRange} />

        <FunnelVisual funnel={funnel} range={shownRange} />

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

        {subs.length > 0 && (
          <>
            <SubmissionsTable
              rows={sorted}
              sort={sort}
              onSort={toggleSort}
              onOpen={open}
            />
            <p className="text-xs text-slate-500">
              {subs.length.toLocaleString()} submission
              {subs.length === 1 ? "" : "s"} · click any row for the full
              record
              {capped
                ? " · showing the 500 most recent, older ones in this range aren't included"
                : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
