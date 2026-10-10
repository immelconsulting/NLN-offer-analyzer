// Shared building blocks for the researched-range results pages
// (ApplyResultsPage and OfferSoonResultsPage). Both show the same range hero,
// sources list, and callouts; only the surrounding copy and ordering differ.

export const money = (n) =>
  typeof n === "number" && Number.isFinite(n)
    ? `$${Math.round(n).toLocaleString("en-US")}`
    : "—";

export const CONFIDENCE_COPY = {
  high: "High confidence — multiple quality sources agreed on this market.",
  medium: "Medium confidence — the data was thinner than we'd like.",
  low: "Low confidence — this leans on adjacent roles or a broader market.",
};

export function RangeRow({ label, points, featured }) {
  const cols = [
    ["Low", points.low],
    ["Target", points.target],
    ["Stretch", points.stretch],
  ];
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
        {cols.map(([name, value], i) => (
          <div
            key={name}
            className={`rounded-lg px-0.5 py-4 sm:px-3 text-center ${
              i === 1 ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-900"
            }`}
          >
            {/* Six-figure numbers overflow a third of a 375px screen at the
                larger sizes, so the mobile step is set to fit "$456,000"
                rather than scaled down from desktop. */}
            <p
              className={`font-serif font-semibold whitespace-nowrap ${
                featured
                  ? "text-[15px] sm:text-xl md:text-2xl"
                  : "text-[15px] sm:text-lg md:text-xl"
              }`}
            >
              {money(value)}
            </p>
            <p
              className={`text-xs mt-1 ${
                i === 1 ? "text-navy-100" : "text-slate-600"
              }`}
            >
              {name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// The hero. Handles the no-data case explicitly rather than rendering
// placeholder numbers that would look authoritative. `floorNote` lets each
// flow word the walk-away line for its own moment.
export function RangeCard({ analysis, noDataNote, floorNote }) {
  const range = analysis.market_range;

  if (!range?.base) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-serif font-semibold text-navy-900 mb-2">
          We couldn't verify a market range for this role
        </h2>
        <p className="text-slate-700">{analysis.range_rationale}</p>
        <p className="text-sm text-slate-500 mt-4">{noDataNote}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <RangeRow label="Base salary" points={range.base} featured />
      {range.total_comp && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <RangeRow label="Total compensation" points={range.total_comp} />
        </div>
      )}

      <p className="text-slate-700 mt-6">{analysis.range_rationale}</p>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-xs text-slate-500">
          {CONFIDENCE_COPY[analysis.confidence] || ""}
        </p>
      </div>

      <p className="text-sm text-navy-800 mt-4 bg-navy-50 rounded-lg px-4 py-3">
        <span className="font-semibold">
          Your walk-away floor is {money(range.base.low)}.
        </span>{" "}
        {floorNote}
      </p>
    </div>
  );
}

export function Callout({ title, children, tone = "dark" }) {
  if (!children) return null;
  if (tone === "light") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
        <h2 className="text-lg font-serif font-semibold text-navy-900 mb-2">
          {title}
        </h2>
        <p className="text-slate-700">{children}</p>
      </div>
    );
  }
  return (
    <div className="bg-navy-900 text-white rounded-xl p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-300 mb-2">
        {title}
      </p>
      <p className="text-lg">{children}</p>
    </div>
  );
}

// Market-data sources the range was built on. Empty when no usable data
// was found.
export function SourceList({ sources }) {
  if (!Array.isArray(sources) || sources.length === 0) return null;

  return (
    <p className="text-sm text-slate-500 -mt-4">
      Market data sourced from{" "}
      {sources.map((s, i) => (
        <span key={`${s.url}-${i}`}>
          {i > 0 && (i === sources.length - 1 ? " and " : ", ")}
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={s.note}
            className="font-medium text-navy-600 hover:text-navy-900 underline transition"
          >
            {s.name}
          </a>
        </span>
      ))}
      .
    </p>
  );
}

// The micro-decision between the $47 script and a paid session. Same pattern
// on both range pages; only the script blurb differs.
export function NextStepChoice({ onGetScript, onBookSession, scriptBlurb }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <p className="font-serif font-semibold text-navy-900 text-xl text-center mb-6">
        What do you want next — a script you can run yourself, or a negotiator
        in your corner?
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={onGetScript}
          className="rounded-lg bg-navy-900 hover:bg-navy-600 text-white p-5 text-center transition"
        >
          <span className="block font-semibold">Get my custom script</span>
          <span className="block text-sm text-navy-100 mt-1">{scriptBlurb}</span>
        </button>
        <button
          type="button"
          onClick={onBookSession}
          className="rounded-lg border-2 border-navy-900 text-navy-900 hover:bg-navy-50 p-5 text-center transition"
        >
          <span className="block font-semibold">Book a Strategy Session</span>
          <span className="block text-sm text-slate-600 mt-1">
            Get Jenny Foss in your corner for the actual call
          </span>
        </button>
      </div>
    </div>
  );
}

// Shown when the result link is missing or corrupt.
export function BrokenResultNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-50 px-6">
      <div className="text-center">
        <p className="text-lg font-medium text-navy-900 mb-2">
          We couldn't load this result.
        </p>
        <p className="text-slate-600 mb-6">
          The link may be broken or incomplete.
        </p>
        <a
          href="/"
          className="inline-block bg-navy-900 text-white rounded-md px-5 py-2.5 font-medium hover:bg-navy-600 transition"
        >
          Start Over
        </a>
      </div>
    </div>
  );
}
