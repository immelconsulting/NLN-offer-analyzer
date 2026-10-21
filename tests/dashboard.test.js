import { describe, it, expect } from "vitest";
import {
  SCRIPT_FUNNEL,
  SESSION_FUNNEL,
  normalizeExclusion,
  isExcludedEmail,
  groupPeople,
  filterPeople,
  funnelCounts,
  kpis,
  byFlow,
  journey,
  purchases,
  autoHidden,
} from "../api/_lib/dashboard.js";

const t = (m) => `2026-10-21T09:${String(m).padStart(2, "0")}:00Z`;
// Pat: full script journey on Apply, visits before and after giving email.
// Sam: anonymous visitor who left at results.
// Alex: testing while logged in to admin (internal).
// Jo: bought a session only.
const events = [
  { t: t(1), e: "landing_viewed", vid: "vid-pat-0001" },
  { t: t(2), e: "lead_captured", vid: "vid-pat-0001", email: "pat@example.com", flow: "apply" },
  { t: t(3), e: "analysis_submitted", vid: "vid-pat-0001", flow: "apply" },
  { t: t(4), e: "results_viewed", vid: "vid-pat-0001", flow: "apply" },
  { t: t(4), e: "results_viewed", vid: "vid-pat-0001", flow: "apply" }, // refresh
  { t: t(5), e: "proof_viewed", vid: "vid-pat-0001", flow: "apply" },
  { t: t(6), e: "script_checkout_clicked", vid: "vid-pat-0001", flow: "apply" },
  { t: t(7), e: "script_purchased", email: "pat@example.com", flow: "apply", amount: 4700, name: "Pat Example" },
  { t: t(1), e: "landing_viewed", vid: "vid-sam-0002" },
  { t: t(2), e: "results_viewed", vid: "vid-sam-0002", flow: "offer" },
  { t: t(1), e: "landing_viewed", vid: "vid-alex-003", internal: true },
  { t: t(2), e: "lead_captured", vid: "vid-alex-003", email: "alex@nextlevelnegotiation.com", flow: "offer", internal: true },
  { t: t(3), e: "session_viewed", vid: "vid-jo-00004" },
  { t: t(4), e: "session_checkout_clicked", vid: "vid-jo-00004" },
  { t: t(5), e: "session_purchased", email: "jo@example.com", tier: "60 minutes", amount: 32900 },
];
const vidmap = { "vid-pat-0001": "pat@example.com", "vid-alex-003": "alex@nextlevelnegotiation.com", "vid-jo-00004": "jo@example.com" };
const names = { "pat@example.com": "Pat Example", "jo@example.com": "Jo Buyer" };
const everyone = groupPeople(events, vidmap, names);
const counts = (people, steps) => Object.fromEntries(funnelCounts(people, steps).map((s) => [s.key, s.count]));

describe("exclusions", () => {
  it("accepts emails and @domains, rejects junk", () => {
    expect(normalizeExclusion(" Alex@NextLevelNegotiation.com ")).toBe("alex@nextlevelnegotiation.com");
    expect(normalizeExclusion("@nextlevelnegotiation.com")).toBe("@nextlevelnegotiation.com");
    expect(normalizeExclusion("alex")).toBeNull();
    expect(normalizeExclusion("")).toBeNull();
  });
  it("matches whole emails and whole domains only", () => {
    expect(isExcludedEmail("a@x.com", ["a@x.com"])).toBe(true);
    expect(isExcludedEmail("b@x.com", ["@x.com"])).toBe(true);
    expect(isExcludedEmail("b@notx.com", ["@x.com"])).toBe(false);
    expect(isExcludedEmail(null, ["@x.com"])).toBe(false);
  });
});

describe("people", () => {
  it("joins a visitor's anonymous and identified events into one person", () => {
    const pat = everyone.find((p) => p.email === "pat@example.com");
    expect(pat.events).toHaveLength(8);
    expect(pat.name).toBe("Pat Example");
    expect([...pat.flows]).toEqual(["apply"]);
  });
  it("keeps anonymous visitors as their own people", () => {
    expect(everyone.some((p) => p.key === "visitor:vid-sam-0002")).toBe(true);
  });
  it("always hides Alex's logged-in testing, plus anyone on the exclusion list", () => {
    const visible = filterPeople(everyone, { exclusions: ["jo@example.com"] });
    expect(visible.map((p) => p.email)).toEqual(["pat@example.com", null]);
  });
  it("filters by flow at the person level, including their pre-flow first visit", () => {
    const apply = filterPeople(everyone, { flow: "apply" });
    expect(apply).toHaveLength(1);
    expect(counts(apply, SCRIPT_FUNNEL).visited).toBe(1);
  });
  it("searches by email or a buyer's name", () => {
    expect(filterPeople(everyone, { q: "jo buyer" }).map((p) => p.email)).toEqual(["jo@example.com"]);
    expect(filterPeople(everyone, { q: "PAT@" })).toHaveLength(1);
  });
});

describe("funnels and KPIs (people, not clicks)", () => {
  const visible = filterPeople(everyone, {});

  it("counts each person once per step, so refreshes don't inflate", () => {
    expect(counts(visible, SCRIPT_FUNNEL)).toEqual({
      visited: 3, gave_email: 1, started_analysis: 1, saw_results: 2,
      opened_offer: 1, started_checkout: 1, bought_script: 1,
    });
    expect(counts(visible, SESSION_FUNNEL)).toEqual({ viewed_session: 1, session_checkout: 1, booked_session: 1 });
  });

  it("lists who reached each step and who stopped just before it", () => {
    const steps = funnelCounts(visible, SCRIPT_FUNNEL);
    const gaveEmail = steps.find((x) => x.key === "gave_email");
    expect(gaveEmail.people.map((p) => p.email)).toEqual(["pat@example.com"]);
    // Sam visited but never gave an email: he's in the drop-off list.
    expect(gaveEmail.droppedCount).toBe(2);
    expect(gaveEmail.droppedOff.some((p) => p.key === "visitor:vid-sam-0002" && p.email === null)).toBe(true);
    expect(steps[0].droppedOff).toEqual([]);
    expect(gaveEmail.people[0]).toMatchObject({ name: "Pat Example", flows: ["apply"] });
    expect(gaveEmail.people[0].lastSeen).toBe("2026-10-21T09:07:00Z");
  });

  it("lists every sale, sessions included, newest first", () => {
    const sales = purchases(visible);
    expect(sales.map((x) => [x.product, x.email, x.amountCents])).toEqual([
      ["script", "pat@example.com", 4700],
      ["session", "jo@example.com", 32900],
    ]);
    expect(sales[1]).toMatchObject({ tier: "60 minutes", name: "Jo Buyer" });
  });

  it("can bring back hidden people, and says who was auto-hidden", () => {
    expect(autoHidden(everyone)).toEqual(["alex@nextlevelnegotiation.com"]);
    const all = filterPeople(everyone, { exclusions: ["jo@example.com"], includeHidden: true });
    expect(all.map((p) => p.email)).toContain("alex@nextlevelnegotiation.com");
    expect(all.map((p) => p.email)).toContain("jo@example.com");
  });

  it("totals sales and revenue", () => {
    expect(kpis(visible)).toEqual({ visitors: 3, emails: 1, analyses: 1, scriptsSold: 1, sessionsSold: 1, revenueCents: 37600 });
  });

  it("breaks down by flow", () => {
    const apply = byFlow(visible).find((f) => f.flow === "apply");
    expect(apply).toEqual({ flow: "apply", people: 1, analyses: 1, scriptsSold: 1, sessionsSold: 0 });
  });

  it("builds one person's timeline in order", () => {
    const j = journey(visible.find((p) => p.email === "pat@example.com"));
    expect(j.events.map((e) => e.e)[0]).toBe("landing_viewed");
    expect(j.events.at(-1)).toMatchObject({ e: "script_purchased", amount: 4700 });
  });
});
