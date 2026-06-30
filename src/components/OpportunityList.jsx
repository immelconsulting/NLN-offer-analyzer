export default function OpportunityList({ opportunities }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8">
      <h2 className="text-lg font-serif font-semibold text-navy-900 mb-5">
        Negotiation Opportunities
      </h2>
      <div className="space-y-4">
        {opportunities.map((opp, i) => (
          <div
            key={i}
            className="flex gap-4 border-b border-slate-100 last:border-0 pb-4 last:pb-0"
          >
            <div className="shrink-0 w-7 h-7 rounded-full bg-navy-900 text-white text-sm font-medium flex items-center justify-center">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="font-medium text-navy-900">{opp.title}</h3>
                {opp.estimatedImpact && (
                  <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {opp.estimatedImpact}
                  </span>
                )}
              </div>
              <p className="text-slate-600 text-sm mt-1">{opp.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
