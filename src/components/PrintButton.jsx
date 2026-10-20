// "Print these results" for the three results pages. The browser's print
// dialog also offers Save as PDF. Never shows on the printout itself; the
// buy/book buttons are hidden in print too (print:hidden on NextStepChoice).
export default function PrintButton() {
  return (
    <button
        type="button"
        onClick={() => window.print()}
        className="print:hidden inline-flex items-center gap-2 rounded-md border border-navy-700 bg-white px-4 py-2 text-sm font-medium text-navy-800 hover:bg-navy-50 transition"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Print these results
      </button>
  );
}
