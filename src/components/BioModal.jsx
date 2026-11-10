import { useEffect, useRef, useState } from "react";
import headshot from "../assets/alex-headshot.jpg";
import { ALEX_LINKEDIN_URL, TRUSTPILOT_REVIEWS_URL } from "../lib/config.js";
import { curlyQuotes } from "../lib/readableText.js";
import { track } from "../lib/track.js";

// "Who's behind this?": a short bio that only ever opens on a click. Never
// automatically, on a timer or on exit, so nothing competes with the form.
// The trigger is reusable anywhere, including inside the $47 pop-up, so Esc is
// caught first here and closes only this one.

const BIO =
  "I'm the founder of Next Level Negotiation (NLN). For 6+ years, I've coached 200+ professionals through job offer and raise negotiations at companies like Amazon, TikTok and OpenAI, and my clients average more than $26k in increases. This tool takes what worked in those real negotiations and tailors it to your role, your market and your situation.";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function BioDialog({ onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Keep focus inside the dialog while it's open.
      const items = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    // Stop the page scrolling behind it, without the page jumping sideways
    // when the scrollbar disappears.
    const { overflow, paddingRight } = document.body.style;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-navy-950/60 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bio-modal-heading"
        className="relative mx-auto my-6 sm:my-16 w-[calc(100%-2rem)] max-w-lg bg-white rounded-xl shadow-xl p-6 pt-10 sm:p-8 text-left"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 h-9 w-9 rounded-full text-xl text-slate-500 hover:bg-navy-50 hover:text-navy-900 transition"
        >
          ×
        </button>
        <div className="flex items-center gap-4 mb-4">
          <img
            src={headshot}
            alt="Alex Immel, founder of Next Level Negotiation"
            width="72"
            height="72"
            className="h-[72px] w-[72px] rounded-full object-cover"
          />
          <h2 id="bio-modal-heading" className="text-2xl font-serif font-semibold text-navy-900">
            {curlyQuotes("Hi, I'm Alex Immel")}
          </h2>
        </div>
        <p className="text-slate-800 leading-relaxed">{curlyQuotes(BIO)}</p>
        <p className="text-sm text-slate-600 mt-4">
          The Job Offer Analyzer is built by Next Level Negotiation in partnership with JobJenny.com.
        </p>
        <p className="mt-4">
          <a
            href={TRUSTPILOT_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-navy-600 hover:text-navy-900 underline"
          >
            Read our reviews on Trustpilot
          </a>
        </p>
        <a
          href={ALEX_LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 block w-full text-center bg-navy-900 hover:bg-navy-600 text-white font-semibold rounded-md px-6 py-3 transition"
        >
          Connect with me on LinkedIn
        </a>
      </div>
    </div>
  );
}

// The inline text button that opens it.
export default function WhoIsBehindThis({ className = "" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  function openModal() {
    track("bio_modal_opened");
    setOpen(true);
  }
  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className={`font-medium text-navy-600 hover:text-navy-900 underline underline-offset-2 ${className}`}
      >
        {curlyQuotes("Who's behind this?")}
      </button>
      {open && <BioDialog onClose={close} />}
    </>
  );
}
