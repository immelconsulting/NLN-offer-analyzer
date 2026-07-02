export default function ScoreCard({ score, interpretation }) {
  const pct = Math.max(0, Math.min(100, score));
  const color =
    pct >= 75 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
      <div className="shrink-0 flex flex-col items-center justify-center w-32 h-32 rounded-full border-8 border-navy-50">
        <span className={`text-4xl font-serif font-bold ${color}`}>{pct}</span>
        <span className="text-xs text-slate-400 uppercase tracking-wide">
          / 100
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-navy-700 uppercase tracking-wide mb-1">
          Offer Score
        </p>
        <p className="text-lg text-slate-800">{interpretation}</p>
      </div>
    </div>
  );
}
