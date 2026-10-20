// Pure dashboard math for /api/admin: no Redis, no request, so it's tested
// directly (tests/dashboard.test.js). Input is the raw event log plus the
// visitor→email and email→name maps; output is people, funnels, KPIs, the
// per-flow breakdown and one person's journey.

import { FLOW_IDS } from "./events.js";

// The script path, top to bottom. Counts are PEOPLE who did the step in the
// date range, not clicks, so refreshing a page doesn't inflate anything.
export const SCRIPT_FUNNEL = [
  { key: "visited", label: "Visited the site", group: "Attract", events: "*" },
  { key: "gave_email", label: "Gave their email", group: "Attract", events: ["lead_captured"] },
  { key: "started_analysis", label: "Started an analysis", group: "Inform", events: ["analysis_submitted"] },
  { key: "saw_results", label: "Saw their results", group: "Inform", events: ["results_viewed"] },
  { key: "opened_offer", label: "Opened the $47 script offer", group: "Convert", events: ["proof_viewed"] },
  { key: "started_checkout", label: "Started checkout", group: "Convert", events: ["script_checkout_clicked"] },
  { key: "bought_script", label: "Bought a script", group: "Convert", events: ["script_purchased"] },
];

export const SESSION_FUNNEL = [
  { key: "viewed_session", label: "Viewed the session page", events: ["session_viewed"] },
  { key: "session_checkout", label: "Started checkout", events: ["session_checkout_clicked"] },
  { key: "booked_session", label: "Bought a session", events: ["session_purchased"] },
];

// An exclusion is a whole email ("alex@x.com") or a domain ("@x.com").
export function normalizeExclusion(value) {
  const v = String(value || "").trim().toLowerCase();
  if (/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return v;
  if (/^[^\s@]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) return v;
  return null;
}

export function isExcludedEmail(email, exclusions) {
  if (!email) return false;
  const e = email.toLowerCase();
  return exclusions.some((x) => (x.startsWith("@") ? e.endsWith(x) : e === x));
}

// Groups events into people. A person is their email once known (from the
// event itself or the visitor→email link), otherwise their anonymous
// visitor id. Events with neither are dropped.
export function groupPeople(events, vidmap = {}, names = {}) {
  const people = new Map();
  for (const ev of events) {
    const email = (ev.email || (ev.vid && vidmap[ev.vid]) || "").toLowerCase();
    const key = email || (ev.vid ? `visitor:${ev.vid}` : null);
    if (!key) continue;
    if (!people.has(key)) {
      people.set(key, { key, email: email || null, name: email ? names[email] || null : null, events: [], flows: new Set(), internal: false });
    }
    const p = people.get(key);
    p.events.push(ev);
    if (ev.flow) p.flows.add(ev.flow);
    if (ev.internal) p.internal = true;
  }
  return [...people.values()];
}

// Applies the admin filters at the person level, so a funnel filtered to
// "Apply" counts everything those people did, including their first visit
// before they picked a stage.
export function filterPeople(people, { flow = null, q = "", exclusions = [] } = {}) {
  const needle = q.trim().toLowerCase();
  return people.filter((p) => {
    if (p.internal || isExcludedEmail(p.email, exclusions)) return false;
    if (flow && !p.flows.has(flow)) return false;
    if (needle) {
      const hay = `${p.email || ""} ${p.name || ""}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

const did = (person, events) =>
  events === "*" ? person.events.length > 0 : person.events.some((ev) => events.includes(ev.e));

// Who's behind each number, so a click on a funnel layer can list them.
// Newest activity first, capped so a busy step can't bloat the response
// (the count stays exact).
export const STEP_PEOPLE_LIMIT = 300;

function summarize(person) {
  const lastSeen = person.events.reduce((latest, ev) => (String(ev.t) > latest ? String(ev.t) : latest), "");
  return { key: person.key, email: person.email, name: person.name, flows: [...person.flows], lastSeen };
}

const newestFirst = (list) =>
  list
    .map(summarize)
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
    .slice(0, STEP_PEOPLE_LIMIT);

export function funnelCounts(people, steps) {
  let previous = null;
  return steps.map((s) => {
    const reached = people.filter((p) => did(p, s.events));
    // Did the step above but not this one: where the funnel leaks.
    const droppedOff = previous ? previous.filter((p) => !did(p, s.events)) : [];
    previous = reached;
    return {
      key: s.key,
      label: s.label,
      group: s.group,
      count: reached.length,
      droppedCount: droppedOff.length,
      people: newestFirst(reached),
      droppedOff: newestFirst(droppedOff),
    };
  });
}

const sumAmount = (people, event) =>
  people.reduce((total, p) => total + p.events.filter((ev) => ev.e === event).reduce((t, ev) => t + (Number(ev.amount) || 0), 0), 0);

const countEvents = (people, event) =>
  people.reduce((n, p) => n + p.events.filter((ev) => ev.e === event).length, 0);

export function kpis(people) {
  return {
    visitors: people.length,
    emails: people.filter((p) => did(p, ["lead_captured"])).length,
    analyses: countEvents(people, "analysis_submitted"),
    scriptsSold: countEvents(people, "script_purchased"),
    sessionsSold: countEvents(people, "session_purchased"),
    revenueCents: sumAmount(people, "script_purchased") + sumAmount(people, "session_purchased"),
  };
}

// Which path people came in through and what they bought. Someone who tried
// two stages counts in both.
export function byFlow(people) {
  return FLOW_IDS.map((flow) => {
    const inFlow = people.filter((p) => p.flows.has(flow));
    return {
      flow,
      people: inFlow.length,
      analyses: inFlow.reduce((n, p) => n + p.events.filter((ev) => ev.e === "analysis_submitted" && ev.flow === flow).length, 0),
      scriptsSold: inFlow.reduce((n, p) => n + p.events.filter((ev) => ev.e === "script_purchased" && ev.flow === flow).length, 0),
      sessionsSold: countEvents(inFlow, "session_purchased"),
    };
  });
}

// One person's timeline, oldest first, trimmed to what the page shows.
export function journey(person) {
  if (!person) return null;
  return {
    email: person.email,
    name: person.name,
    flows: [...person.flows],
    events: [...person.events]
      .sort((a, b) => String(a.t).localeCompare(String(b.t)))
      .map((ev) => ({ t: ev.t, e: ev.e, flow: ev.flow || null, amount: ev.amount ?? null, tier: ev.tier || null })),
  };
}
