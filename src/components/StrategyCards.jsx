import { useState } from "react";

const RISK_STYLES = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-rose-50 text-rose-700 border-rose-200",
};

const TABS = [
  { key: "conservative", label: "Low Risk", color: "text-emerald-700" },
  { key: "balanced", label: "Medium Risk", color: "text-amber-700" },
  { key: "aggressive", label: "High Risk", color: "text-rose-700" },
];

function StrategyCard({ strategy, recommended }) {
  return (
    <div
      className={`relative rounded-xl border p-6 sm:p-8 bg-white ${
        recommended
          ? "border-navy-700 shadow-md ring-1 ring-navy-700"
          : "border-slate-200 shadow-sm"
      }`}
    >
      {recommended && (
        <span className="absolute -top-3 left-6 bg-navy-900 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full">
          Recommended
        </span>
      )}
      <h3 className="font-serif font-semibold text-lg text-navy-900 mt-1">
        {strategy.name}
      </h3>
      <span
        className={`inline-block mt-2 text-xs font-medium px-2 py-0.5 rounded border ${
          RISK_STYLES[strategy.riskLevel] || "bg-slate-50 text-slate-600 border-slate-200"
        }`}
      >
        {strategy.riskLevel} Risk
      </span>

      <p className="text-sm text-slate-700 mt-4">
        <span className="font-medium text-navy-800">Expected outcome: </span>
        {strategy.expectedOutcome}
      </p>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Pros
          </p>
          <ul className="text-sm text-slate-700 space-y-1">
            {strategy.pros.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-emerald-600">+</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
            Cons
          </p>
          <ul className="text-sm text-slate-700 space-y-1">
            {strategy.cons.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-rose-500">−</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function StrategyCards({ strategies, recommendedKey = "balanced" }) {
  const [active, setActive] = useState(recommendedKey);

  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-navy-900 mb-4">
        Your Negotiation Strategies
      </h2>
      <div className="grid grid-cols-3 gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-lg border px-2 py-3 text-center transition ${
              active === t.key
                ? "bg-white border-navy-600 ring-1 ring-navy-600 shadow-sm"
                : "bg-white/60 border-slate-200 hover:border-navy-300"
            }`}
          >
            <span className={`block text-sm font-semibold ${t.color}`}>
              {t.label}
            </span>
            {recommendedKey === t.key && (
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-navy-600 mt-0.5">
                Recommended
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <StrategyCard
          strategy={strategies[active]}
          recommended={recommendedKey === active}
        />
      </div>
    </div>
  );
}
