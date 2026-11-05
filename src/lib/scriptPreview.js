import { curlyQuotes } from "./readableText.js";

// Asks the server for the free script preview until it's ready, gives up after
// a minute, and reports once. Any failure just means no preview.

const CHECK_EVERY_MS = 3000;

// Splits the written opening at its markdown headers and adds the sections not
// written yet, so the page can show every header and hide everything else.
// `body` is real text, `placeholder` means nothing is written for it yet.
// The page introduces Alex above the script, so the opening's own "I'm Alex..."
// sentence would repeat it there. It stays in the paid script, which can be read
// on its own.
const ALEX_INTRO = /^(?:hi[,!]?\s+)?(?:i'm|i’m|i am|this is|my name is)\s+alex\b[^.!]*[.!]\s*/i;

export function previewSections(preview, headings = []) {
  const sections = [];
  let current = null;
  const start = (heading) => {
    current = { heading, lines: [] };
    sections.push(current);
  };
  for (const line of (preview || "").split("\n")) {
    if (/^#{1,6}\s/.test(line)) start(line.trim());
    else {
      if (!current) start(null);
      current.lines.push(line);
    }
  }
  const opening = sections
    .map(({ heading, lines }) => ({ heading, body: lines.join("\n").trim() }))
    .filter(({ heading, body }) => heading || body);
  const intro = opening.find(({ body }) => body);
  if (intro) intro.body = intro.body.replace(ALEX_INTRO, "");
  for (const section of opening) section.body = curlyQuotes(section.body);
  for (const section of opening) section.heading = curlyQuotes(section.heading);
  const last = opening[opening.length - 1];
  if (last && !last.body) last.placeholder = true;
  return [...opening, ...headings.map((h) => ({ heading: curlyQuotes(`## ${h}`), body: "", placeholder: true }))];
}
const GIVE_UP_MS = 60_000;

// Calls onDone once, with { status: "ready", preview, headings, flow } or
// { status: "none" }. Returns a function that cancels it.
export function watchPreview(submissionId, onDone) {
  let done = false;
  let timer;
  let giveUp;
  const controller = new AbortController();

  const stop = () => {
    done = true;
    clearTimeout(timer);
    clearTimeout(giveUp);
  };
  const finish = (result) => {
    if (done) return;
    stop();
    onDone(result);
  };

  giveUp = setTimeout(() => {
    finish({ status: "none" });
    controller.abort();
  }, GIVE_UP_MS);

  async function check() {
    try {
      const res = await fetch("/api/generate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, submissionId }),
        signal: controller.signal,
      });
      if (done) return;
      const body = res.ok ? await res.json() : { status: "none" };
      if (done) return;
      if (body.status === "ready" && body.preview) finish(body);
      else if (body.status === "generating") timer = setTimeout(check, CHECK_EVERY_MS);
      else finish({ status: "none" });
    } catch {
      finish({ status: "none" });
    }
  }
  check();

  return () => {
    stop();
    controller.abort();
  };
}
