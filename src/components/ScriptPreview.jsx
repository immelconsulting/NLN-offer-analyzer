import { useEffect, useRef, useState } from "react";
import ScriptMarkdown from "./ScriptMarkdown.jsx";
import { track } from "../lib/track.js";
import { watchPreview } from "../lib/scriptPreview.js";

// The free opening of their script on the $47 page. Everything here is extra:
// the page and its buy buttons never wait for it, and if it fails or takes too
// long this simply disappears and the page is what it was before.

export function useScriptPreview(submissionId) {
  const [state, setState] = useState(submissionId ? { status: "loading" } : { status: "none" });

  useEffect(() => {
    if (!submissionId) return undefined;
    return watchPreview(submissionId, setState);
  }, [submissionId]);

  return state;
}

export default function ScriptPreview({ state, onUnlock }) {
  const shownRef = useRef(null);
  const ready = state.status === "ready";

  // Counted when it's actually on screen, not when it finishes loading below
  // the fold.
  useEffect(() => {
    const el = shownRef.current;
    if (!ready || !el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      track("script_preview_viewed");
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        track("script_preview_viewed");
        observer.disconnect();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  if (state.status === "loading") {
    return (
      <section id="script-preview" className="scroll-mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
        <p className="text-sm font-medium text-navy-600 animate-pulse" role="status">
          Writing a preview of your script…
        </p>
      </section>
    );
  }
  if (!ready) return null;

  return (
    <section id="script-preview" className="scroll-mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
      <p className="text-sm font-semibold uppercase tracking-wider text-navy-600 mb-4">
        A preview of your script
      </p>
      <div ref={shownRef}>
        <ScriptMarkdown>{state.preview}</ScriptMarkdown>
      </div>

      <div className="relative mt-6 border-t border-slate-200 pt-6">
        <p className="text-sm font-semibold text-navy-900 mb-3">Still to come in your full script:</p>
        <ul className="space-y-2 text-lg font-serif font-semibold text-navy-900">
          {(state.headings || []).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-white/0 to-white" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="mt-4 w-full bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-4 transition shadow-sm"
      >
        Unlock your full script, $47
      </button>
    </section>
  );
}
