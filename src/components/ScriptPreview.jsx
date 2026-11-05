import { useEffect, useRef, useState } from "react";
import AlexIntro from "./AlexIntro.jsx";
import ScriptMarkdown from "./ScriptMarkdown.jsx";
import { track } from "../lib/track.js";
import { previewSections, watchPreview } from "../lib/scriptPreview.js";

// What they'd be buying, at the bottom of the results page: the opening to read
// (it's written before payment and becomes the top of their script), then every
// later section's header in the clear with this placeholder blurred under it.
// Nothing real is ever under the blur. Everything here is extra: the buttons never
// wait for it, and if it fails or takes too long it simply disappears.

// One line each, so the page stays short enough to reach the buy button on a phone.
const PLACEHOLDERS = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.',
  '🗣️ "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum."',
  '🗣️ "Sed ut perspiciatis unde omnis iste natus error sit voluptatem."',
];

export function useScriptPreview(submissionId) {
  const [state, setState] = useState(submissionId ? { status: "loading" } : { status: "none" });

  useEffect(() => {
    if (!submissionId) return undefined;
    return watchPreview(submissionId, setState);
  }, [submissionId]);

  return state;
}

export default function ScriptPreview({ state, onUnlock, onDetails }) {
  const shownRef = useRef(null);
  const ready = state.status === "ready";
  const sections = ready ? previewSections(state.preview, state.headings) : [];

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
      <section id="script-preview" className="scroll-mt-6 print:hidden bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center">
        <p className="text-sm font-medium text-navy-600 animate-pulse" role="status">
          Writing the start of your script…
        </p>
      </section>
    );
  }
  if (!ready) return null;

  return (
    <>
      <AlexIntro />
    <section id="script-preview" className="scroll-mt-6 print:hidden bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-10">
      <h2 className="text-2xl font-serif font-semibold text-navy-900">Now, let's get to your script</h2>
      <p className="text-slate-700 mt-2 mb-4">Unlock it to read the rest, written around your numbers.</p>
      <button
        type="button"
        onClick={onUnlock}
        className="mb-8 w-full bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-4 transition shadow-sm"
      >
        Unlock your full script, $47
      </button>
      <div ref={shownRef}>
        {sections.map((section, i) => (
          <div key={i} className="mt-6 first:mt-0">
            {section.heading && <ScriptMarkdown>{section.heading}</ScriptMarkdown>}
            {section.body && <ScriptMarkdown spokenBlocks>{section.body}</ScriptMarkdown>}
            {section.placeholder && (
              <div data-blurred className="blur-[7px] select-none pointer-events-none" aria-hidden="true">
                <ScriptMarkdown spokenBlocks>{PLACEHOLDERS[i % PLACEHOLDERS.length]}</ScriptMarkdown>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="mt-6 w-full bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-4 transition shadow-sm"
      >
        Unlock your full script, $47
      </button>
      {onDetails && (
        <p className="text-center text-sm mt-3">
          <button type="button" onClick={onDetails} className="font-medium text-navy-600 hover:text-navy-900 underline">
            See what you get for $47
          </button>
        </p>
      )}
    </section>
    </>
  );
}
