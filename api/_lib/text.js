// Safety net for Alex's "no em dashes" rule (they read as AI-written). The
// prompts forbid them, but a model can still slip one in, so every analysis
// and script passes through here before anyone sees it. Works on strings,
// arrays and plain objects (an analysis is a nested object). En dashes in
// number ranges ("$90–110k") and markdown table/rule dashes ("---") are left
// alone; only em dashes and spaced double hyphens are rewritten.

function fixString(s) {
  return s
    .replace(/(\*\*[^*\n]+\*\*)\s*(?:—|\s--\s)\s*/g, "$1: ") // "**Label** — text" → "**Label**: text"
    .replace(/(^|\n)(\s*(?:[-*]|\d+\.)?\s*)—\s*/g, "$1$2") // a dash opening a line just goes
    .replace(/\s*—\s*/g, ", ")
    .replace(/ -- /g, ", ")
    .replace(/,\s*([.,;:!?)])/g, "$1"); // never leave ", ." behind
}

export function stripEmDashes(value) {
  if (typeof value === "string") return fixString(value);
  if (Array.isArray(value)) return value.map(stripEmDashes);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmDashes(v)]));
  }
  return value;
}
