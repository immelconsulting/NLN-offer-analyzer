// Pure logic for matching prior submissions to a new offer and summarizing
// them as anonymized market context. No Redis or network calls here so the
// whole file is unit-testable in plain Node.

// Common title abbreviations, expanded before matching.
const SYNONYMS = {
  ae: "account executive",
  sdr: "sales development representative",
  bdr: "business development representative",
  csm: "customer success manager",
  swe: "software engineer",
  sde: "software engineer",
  pm: "product manager",
  tpm: "technical program manager",
  em: "engineering manager",
  ds: "data scientist",
  da: "data analyst",
  qa: "quality assurance",
  rn: "registered nurse",
  np: "nurse practitioner",
  pa: "physician assistant",
  hr: "human resources",
  mgr: "manager",
  sr: "senior",
  jr: "junior",
  eng: "engineer",
  dev: "developer",
  rep: "representative",
};

// Seniority/level words are ignored when comparing role cores, so
// "Senior Account Executive" matches "Account Executive".
const LEVEL_TOKENS = new Set([
  "senior", "junior", "lead", "principal", "staff", "associate", "head",
  "i", "ii", "iii", "iv", "v", "1", "2", "3", "4", "5",
]);

export function titleTokens(role) {
  const words = String(role || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => (SYNONYMS[w] || w).split(" "));
  return new Set(words.filter((w) => !LEVEL_TOKENS.has(w)));
}

// Two titles match when their core tokens overlap strongly (Jaccard >= 0.5)
// or one is contained in the other ("account executive" vs
// "enterprise account executive").
export function titlesMatch(a, b) {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  const jaccard = shared / (ta.size + tb.size - shared);
  const containment = shared === Math.min(ta.size, tb.size);
  return jaccard >= 0.5 || containment;
}

// City-level location match: "Denver, CO" -> "denver".
export function normalizeCity(location) {
  return String(location || "").split(",")[0].trim().toLowerCase();
}

export function parseSalary(value) {
  const digits = String(value || "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : null;
}

function median(sorted) {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// IQR outlier fence. Chosen over z-scores because our samples are small and
// a z-score is dragged around by the very outlier it is trying to detect;
// quartiles are robust at these sizes.
export function filterOutliersIQR(values) {
  if (values.length < 5) return values; // too few points to judge outliers
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return sorted.filter((v) => v >= lo && v <= hi);
}

const fmt = (n) => `$${n.toLocaleString("en-US")}`;

// Builds the anonymized aggregate passed to the model, or null when there
// isn't enough data. Policy (per Alex): nothing below 3 matches; median only
// at 3-4; median + range (after IQR filtering) at 5+.
export function buildComparablesSummary(submissions, { role, location, excludeEmail }) {
  const city = normalizeCity(location);
  const matches = submissions.filter((s) => {
    if (!s?.form?.role || !s?.form?.location) return false;
    // Pre-offer submissions (applying, interviewing) are aspirational targets,
    // not real offers, so they must never become market data for someone
    // else's analysis. They lack offerBaseSalary today and would fall out
    // below anyway; this is explicit so a later field addition can't quietly
    // let them in, and covers any future non-offer flow by default.
    if (s.flow && s.flow !== "offer") return false;
    if (excludeEmail && s.email && s.email === excludeEmail.trim().toLowerCase()) return false;
    return (
      titlesMatch(s.form.role, role) &&
      normalizeCity(s.form.location) === city &&
      parseSalary(s.form.offerBaseSalary) !== null
    );
  });

  const salaries = matches
    .map((s) => parseSalary(s.form.offerBaseSalary))
    .sort((a, b) => a - b);

  if (salaries.length < 3) return null;

  if (salaries.length < 5) {
    return `${salaries.length} similar past submissions (comparable role in ${location}): median base salary ~${fmt(median(salaries))}.`;
  }

  const filtered = filterOutliersIQR(salaries);
  if (filtered.length < 3) return null;
  if (filtered.length < 5) {
    return `${filtered.length} similar past submissions (comparable role in ${location}): median base salary ~${fmt(median(filtered))}.`;
  }
  return `${filtered.length} similar past submissions (comparable role in ${location}): base salary range ${fmt(filtered[0])}–${fmt(filtered[filtered.length - 1])}, median ~${fmt(median(filtered))}.`;
}
