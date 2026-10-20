import { useState } from "react";

// Dashboard pieces for the admin page: headline numbers, the funnel, the
// per-flow breakdown, one person's journey, and the hidden-people list.
// All numbers come from /api/admin, which counts PEOPLE (not clicks) and has
// already removed Alex's own testing and anyone on the exclusion list.

export const FLOW_OPTIONS = [
  ["All flows", "all"],
  ["Offer", "offer"],
  ["Apply", "apply"],
  ["Interview", "interview"],
  ["Offer soon", "offer_soon"],
];

const FLOW_NAMES = {
  offer: "Received an offer",
  apply: "Applying",
  interview: "Interviewing",
  offer_soon: "Expecting an offer soon",
};

const EVENT_LABELS = {
  landing_viewed: "Visited the site",
  lead_captured: "Gave their email",
  analysis_submitted: "Started an analysis",
  results_viewed: "Saw their results",
  script_cta_clicked: "Clicked “Get my script”",
  session_cta_clicked: "Clicked “Book a session”",
  proof_viewed: "Opened the $47 script offer",
  script_checkout_clicked: "Started script checkout",
  script_purchased: "Bought a script",
  script_generated: "Script delivered",
  script_pdf_downloaded: "Downloaded the PDF",
  session_viewed: "Viewed the session page",
  session_checkout_clicked: "Started session checkout",
  session_purchased: "Bought a session",
  booking_confirmed: "Reached Jenny's calendar",
};
const PURCHASES = ["script_purchased", "session_purchased"];

export const chipClass = (active) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition border ${
    active
      ? "bg-navy-900 border-navy-900 text-white"
      : "bg-white border-slate-300 text-slate-700 hover:border-navy-600 hover:text-navy-900"
  }`;

const money = (cents) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

function pctOf(part, whole) {
  if (!whole) return "—";
  const p = (part / whole) * 100;
  if (p > 0 && p < 1) return "<1%";
  return `${Math.round(p)}%`;
}

// ---- Color: one brand-blue scale, light at the top of the funnel to dark at
// the bottom (sequential: depth, not identity). Text picks whichever of navy
// or white has more contrast on each layer.
const BRAND_STOPS = ["#D8F0F8", "#6BCCF7", "#0099CC", "#16163F"];
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

function rampColor(t) {
  const scaled = Math.min(Math.max(t, 0), 1) * (BRAND_STOPS.length - 1);
  const i = Math.min(Math.floor(scaled), BRAND_STOPS.length - 2);
  const f = scaled - i;
  const [a, b] = [hexToRgb(BRAND_STOPS[i]), hexToRgb(BRAND_STOPS[i + 1])];
  return rgbToHex(a.map((v, k) => v + (b[k] - v) * f));
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const INK = "#001E34";
const textOn = (fill) => (contrast(fill, INK) >= contrast(fill, "#FFFFFF") ? INK : "#FFFFFF");

// ---- Headline numbers

export function KpiRow({ kpis }) {
  if (!kpis) return null;
  const tiles = [
    ["Visitors", kpis.visitors.toLocaleString()],
    ["Emails captured", kpis.emails.toLocaleString()],
    ["Analyses started", kpis.analyses.toLocaleString()],
    ["Scripts sold", kpis.scriptsSold.toLocaleString()],
    ["Sessions sold", kpis.sessionsSold.toLocaleString()],
    ["Revenue", money(kpis.revenueCents)],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map(([label, value]) => (
        <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-4 text-center">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-navy-950 tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ---- The funnel: stacked trapezoids, each layer a step. Widths taper
// evenly (like a drawn funnel) rather than by count, so small numbers stay
// legible; the counts and step-to-step conversion carry the magnitude.

// `compact` draws on a narrower canvas for the side column, so its text
// renders at the same size as the main funnel's instead of being shrunk.
// Every layer is a button: clicking one lists who reached that step (and who
// dropped off just before it) underneath; clicking a person opens their
// journey via onPerson.
export function FunnelChart({ steps, title, note, showGroups = true, compact = false, onPerson }) {
  const [hover, setHover] = useState(null);
  const [selected, setSelected] = useState(null);
  if (!steps?.length) return null;
  const toggle = (i) => setSelected((cur) => (cur === i ? null : i));

  const W = compact ? 400 : 640;
  const layerH = 54;
  const gap = 2;
  const groupW = showGroups ? 92 : 0;
  const top = { left: groupW + 6, right: W - (compact ? 118 : 150) };
  const bottomWidthShare = compact ? 0.55 : 0.34;
  const n = steps.length;
  const fullWidth = top.right - top.left;
  const center = (top.left + top.right) / 2;
  const widthAt = (i) => fullWidth * (1 - ((1 - bottomWidthShare) * i) / n);
  const H = n * layerH + (n - 1) * gap;

  // Consecutive steps sharing a group get one band on the left.
  const groups = [];
  steps.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (showGroups && s.group && last?.name === s.group) last.end = i;
    else if (showGroups && s.group) groups.push({ name: s.group, start: i, end: i });
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-base font-serif font-semibold text-navy-900">{title}</h2>
        {note && <span className="text-xs text-slate-500">{note}</span>}
      </div>
      <p className="text-xs text-slate-500 -mt-2 mb-3">Click a layer to see who&rsquo;s in it.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}: ${steps.map((s) => `${s.label} ${s.count}`).join(", ")}`}>
        {groups.map((g) => {
          const y = g.start * (layerH + gap);
          const h = (g.end - g.start + 1) * (layerH + gap) - gap;
          return (
            <g key={g.name}>
              <rect x={0} y={y} width={groupW - 4} height={h} rx={4} fill="#16163F" />
              <text x={12} y={y + h / 2} dominantBaseline="middle" fill="#FFFFFF" fontSize="15" fontWeight="600">
                {g.name}
              </text>
            </g>
          );
        })}
        {steps.map((s, i) => {
          const y = i * (layerH + gap);
          const wTop = widthAt(i);
          const wBottom = widthAt(i + 1);
          const fill = rampColor(n === 1 ? 0 : i / (n - 1));
          const ink = textOn(fill);
          const points = [
            [center - wTop / 2, y],
            [center + wTop / 2, y],
            [center + wBottom / 2, y + layerH],
            [center - wBottom / 2, y + layerH],
          ]
            .map((p) => p.join(","))
            .join(" ");
          const prev = i === 0 ? null : steps[i - 1].count;
          const isSelected = selected === i;
          const active = hover === i || isSelected;
          return (
            <g
              key={s.key}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${s.label}: ${s.count} ${s.count === 1 ? "person" : "people"}. Show who.`}
              onClick={() => toggle(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(i);
                }
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>
                {`${s.label}: ${s.count.toLocaleString()} ${s.count === 1 ? "person" : "people"}`}
                {prev !== null ? ` · ${pctOf(s.count, prev)} of the step above` : ""}
                {` · ${pctOf(s.count, steps[0].count)} of the top`}
              </title>
              <polygon
                points={points}
                fill={fill}
                stroke={active ? INK : "none"}
                strokeWidth={isSelected ? 3 : active ? 1.5 : 0}
              />
              <text x={center} y={y + layerH / 2 - 8} textAnchor="middle" dominantBaseline="middle" fill={ink} fontSize="13">
                {s.label}
              </text>
              <text x={center} y={y + layerH / 2 + 11} textAnchor="middle" dominantBaseline="middle" fill={ink} fontSize="17" fontWeight="700">
                {s.count.toLocaleString()}
              </text>
              {prev !== null && (
                <text x={top.right + 14} y={y + layerH / 2} dominantBaseline="middle" fill="#475569" fontSize="13">
                  <tspan fontWeight="600" fill={INK}>{pctOf(s.count, prev)}</tspan>{compact ? " of above" : " of step above"}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {selected !== null && steps[selected] && (
        <StepPeople
          step={steps[selected]}
          isFirst={selected === 0}
          previousLabel={selected > 0 ? steps[selected - 1].label : null}
          onPerson={onPerson}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

// The people behind one funnel layer: who reached it, or who did the step
// above and stopped (usually the more useful list).
function StepPeople({ step, isFirst, previousLabel, onPerson, onClose }) {
  const [view, setView] = useState("reached");
  const showDropped = view === "dropped" && !isFirst;
  const list = showDropped ? step.droppedOff || [] : step.people || [];
  const total = showDropped ? step.droppedCount || 0 : step.count;

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-navy-900">{step.label}</h3>
        <button type="button" onClick={onClose} className="text-sm font-medium text-navy-600 hover:text-navy-900">
          Close ×
        </button>
      </div>
      {!isFirst && (
        <div className="flex flex-wrap gap-2 mb-3">
          <button type="button" onClick={() => setView("reached")} className={chipClass(!showDropped)}>
            Reached this step ({step.count})
          </button>
          <button type="button" onClick={() => setView("dropped")} className={chipClass(showDropped)}>
            Stopped after &ldquo;{previousLabel}&rdquo; ({step.droppedCount || 0})
          </button>
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-slate-500">Nobody here in this date range.</p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          {list.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => onPerson?.(p)}
                className="w-full text-left px-3 py-2 hover:bg-navy-50 transition flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                title="Show this person's journey"
              >
                <span className="text-sm text-navy-950">
                  {p.email ? (
                    <>
                      {p.name && <span className="font-semibold">{p.name} · </span>}
                      <span className="underline decoration-navy-300 underline-offset-2">{p.email}</span>
                    </>
                  ) : (
                    <span className="text-slate-600">Anonymous visitor (no email yet)</span>
                  )}
                  {p.flows.length > 0 && (
                    <span className="text-slate-500"> · {p.flows.map((f) => FLOW_NAMES[f] || f).join(", ")}</span>
                  )}
                </span>
                <span className="text-xs text-slate-500">
                  {p.lastSeen ? `last active ${new Date(p.lastSeen).toLocaleString()}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {total > list.length && (
        <p className="text-xs text-slate-500 mt-2">
          Showing the {list.length} most recently active of {total}.
        </p>
      )}
    </div>
  );
}

// ---- Per-flow breakdown: one bar chart per measure, flows named on the
// bars (single series each, so no color legend needed).

function BarList({ title, rows, valueKey }) {
  const max = Math.max(1, ...rows.map((r) => r[valueKey]));
  return (
    <div>
      <h3 className="text-sm font-semibold text-navy-900 mb-2">{title}</h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.flow} className="grid grid-cols-[11.5rem_1fr_2.5rem] items-center gap-2" title={`${FLOW_NAMES[r.flow]}: ${r[valueKey]}`}>
            <span className="text-sm text-slate-600 truncate">{FLOW_NAMES[r.flow]}</span>
            <div className="h-3 rounded-r bg-slate-100">
              <div className="h-3 rounded-r bg-navy-600" style={{ width: `${(r[valueKey] / max) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold text-navy-950 tabular-nums text-right">{r[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FlowBreakdown({ rows }) {
  if (!rows) return null;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
      <h2 className="text-base font-serif font-semibold text-navy-900 mb-4">By flow</h2>
      <div className="grid md:grid-cols-3 gap-6">
        <BarList title="People" rows={rows} valueKey="people" />
        <BarList title="Analyses started" rows={rows} valueKey="analyses" />
        <BarList title="Scripts sold" rows={rows} valueKey="scriptsSold" />
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Someone who tried more than one stage counts in each. Sessions aren't tied to a flow, so
        they're in the session funnel instead.
      </p>
    </div>
  );
}

// ---- One person's journey

export function JourneyPanel({ journey, onClose }) {
  if (!journey) return null;
  return (
    <div className="bg-white rounded-xl border border-navy-300 shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-serif font-semibold text-navy-900">
            Journey: {journey.name ? `${journey.name} · ` : ""}
            {journey.email || "anonymous visitor"}
          </h2>
          {journey.flows.length > 0 && (
            <p className="text-sm text-slate-500 mt-0.5">
              {journey.flows.map((f) => FLOW_NAMES[f] || f).join(", ")}
            </p>
          )}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="text-sm font-medium text-navy-600 hover:text-navy-900">
            Clear ×
          </button>
        )}
      </div>
      {journey.events.length === 0 ? (
        <p className="text-sm text-slate-500">No tracked activity in this date range.</p>
      ) : (
        <ol className="relative border-l-2 border-navy-100 ml-2 space-y-3">
          {journey.events.map((ev, i) => (
            <li key={i} className="ml-4">
              <span
                className={`absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-2 ring-white ${
                  PURCHASES.includes(ev.e) ? "bg-navy-950" : "bg-navy-600"
                }`}
              />
              <p className="text-sm text-navy-950">
                <span className={PURCHASES.includes(ev.e) ? "font-semibold" : ""}>
                  {EVENT_LABELS[ev.e] || ev.e}
                </span>
                {ev.tier ? ` (${ev.tier})` : ""}
                {ev.amount ? ` · ${money(ev.amount)}` : ""}
                {ev.flow ? <span className="text-slate-500"> · {FLOW_NAMES[ev.flow]}</span> : null}
              </p>
              <p className="text-xs text-slate-500">{new Date(ev.t).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---- Hidden people (exclusions)

export function ExclusionsPanel({ exclusions, onChange }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(action, v) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value: v }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't update the list.");
      setValue("");
      onChange(body.exclusions);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-navy-900">
          Hidden people ({exclusions.length})
        </span>
        <span className="text-sm text-slate-500">{open ? "Close ▲" : "Manage ▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-sm text-slate-600">
            Anyone listed here is left out of every number, table and export. Use a full email, or
            a domain like <code className="text-navy-900">@nextlevelnegotiation.com</code> to hide
            everyone at it. Anything you do while signed in to this page is hidden automatically.
          </p>
          {exclusions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {exclusions.map((x) => (
                <span key={x} className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-3 py-1 text-sm text-navy-950">
                  {x}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => send("include", x)}
                    className="ml-1 text-slate-500 hover:text-rose-700"
                    aria-label={`Stop hiding ${x}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (value.trim()) send("exclude", value);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="email@example.com or @example.com"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
            <button
              type="submit"
              disabled={busy || !value.trim()}
              className="shrink-0 rounded-md bg-navy-900 hover:bg-navy-600 disabled:opacity-40 text-white text-sm font-medium px-4 transition"
            >
              Hide
            </button>
          </form>
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
