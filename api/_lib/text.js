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

function mapStrings(value, fix) {
  if (typeof value === "string") return fix(value);
  if (Array.isArray(value)) return value.map((v) => mapStrings(v, fix));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fix)]));
  }
  return value;
}

export function stripEmDashes(value) {
  return mapStrings(value, fixString);
}

// Jenny flagged this phrase as jargon (Nov 2026). The prompts no longer use it,
// but scripts bought before the change still contain it, so they're rewritten
// whenever they're read: as a section header, or as a phrase in running text.
export const ONE_LINE_CASE_HEADER = "Your one-line case for why you're worth more";

function fixJargon(s) {
  return s
    .replace(/^(#{1,6}[ \t]+(?:\d+\.[ \t]*)?)[^\n]*value[\s-]+headline[^\n]*$/gim, `$1${ONE_LINE_CASE_HEADER}`)
    .replace(/value[\s-]+headline(s?)/gi, (match, plural) => `${match[0] === "V" ? "One" : "one"}-line pitch${plural}`);
}

// Everything a model writes passes through here before a customer sees it.
export function cleanForCustomers(value) {
  return mapStrings(value, (s) => fixJargon(fixString(s)));
}
