const RISK_STYLES = {
  Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-rose-50 text-rose-700 border-rose-200",
};

function StrategyCard({ strategy, recommended }) {
  return (
    <div
      className={`relative flex-1 rounded-xl border p-6 bg-white ${
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

      <div className="mt-4">
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

      <div className="mt-4">
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
  );
}

export default function StrategyCards({ strategies }) {
  return (
    <div>
      <h2 className="text-lg font-serif font-semibold text-navy-900 mb-5">
        Your Negotiation Strategies
      </h2>
      <div className="grid sm:grid-cols-3 gap-6 sm:gap-5 pt-3">
        <StrategyCard strategy={strategies.conservative} />
        <StrategyCard strategy={strategies.balanced} recommended />
        <StrategyCard strategy={strategies.aggressive} />
      </div>
    </div>
  );
}
