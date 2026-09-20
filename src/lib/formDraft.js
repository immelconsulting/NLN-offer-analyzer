// Remembers what someone has typed so switching paths (applying vs. an offer
// in hand) doesn't mean re-entering everything. Scoped to the browser session,
// the same as the landing-page lead record.
//
// Only plain text fields are kept. Uploaded files are deliberately excluded:
// a 2MB upload becomes ~2.7MB of base64, and two of them would blow the ~5MB
// sessionStorage quota, so re-picking a file is the cost of keeping the rest
// of the form reliable.

const KEY = "nln:formDraft";

// Fields that mean the same thing in both forms and can be carried across.
// currentSalary (offer: base only) and currentTotalComp (apply: everything)
// are deliberately NOT shared — they are different questions, and crossing
// them would silently corrupt the walk-away floor.
const SHARED = [
  "role",
  "targetRole",
  "company",
  "targetCompany",
  "location",
  "industry",
  "currentSalary",
  "currentTotalComp",
  "yearsExperience",
  "riskTolerance",
  "salaryStage",
  "sharedNumber",
  "additionalContext",
  "jobDescriptionText",
];

export function loadDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Pairs that are the same question under two names. Writing one writes the
// other, so the value you typed most recently is what the other form shows.
// Without this, each form's own key would shadow the alias and a later edit
// on one side would appear stale on the other.
const MIRRORED = {
  role: "targetRole",
  targetRole: "role",
  company: "targetCompany",
  targetCompany: "company",
};

// Merges a patch into the stored draft. Never throws — a storage failure
// should cost the convenience, not the form.
export function saveDraft(patch) {
  try {
    const next = { ...loadDraft() };
    for (const [key, value] of Object.entries(patch)) {
      if (!SHARED.includes(key) || typeof value !== "string") continue;
      next[key] = value;
      if (MIRRORED[key]) next[MIRRORED[key]] = value;
    }
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private-mode failure; drafts are a convenience only.
  }
}

// Builds initial form state by overlaying the draft onto a form's defaults,
// keeping only keys that form actually has. `aliases` maps a field in this
// form to the equivalent field in the other one ("targetRole" <- "role").
export function withDraft(initialState, aliases = {}) {
  const draft = loadDraft();
  const next = { ...initialState };
  for (const key of Object.keys(initialState)) {
    const fromAlias = aliases[key] ? draft[aliases[key]] : undefined;
    const value = draft[key] ?? fromAlias;
    if (typeof value === "string" && value) next[key] = value;
  }
  return next;
}
