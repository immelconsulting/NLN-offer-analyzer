import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ authed: true, events: [], exclusions: new Set(), recorded: [], vidmap: {}, names: {} }));

vi.mock("../api/_lib/auth.js", () => ({ isAuthorized: () => h.authed }));
vi.mock("../api/_lib/store.js", async (orig) => ({
  ...(await orig()),
  listRecentSubmissions: async () => [
    { id: "s1", email: "pat@example.com", timestamp: new Date().toISOString(), flow: "apply", form: { targetRole: "Analyst" }, analysis: {} },
    { id: "s2", email: "alex@nextlevelnegotiation.com", timestamp: new Date().toISOString(), form: { role: "Test" }, analysis: {} },
  ],
  getRedis: () => ({
    hgetall: async (k) => (k === "nln:vidmap" ? h.vidmap : h.names),
    smembers: async () => [...h.exclusions],
    sadd: async (_k, v) => h.exclusions.add(v),
    srem: async (_k, v) => h.exclusions.delete(v),
    incr: async () => 1,
    expire: async () => {},
  }),
}));
vi.mock("../api/_lib/events.js", async (orig) => ({
  ...(await orig()),
  readEvents: async () => h.events,
  recordEvent: async (_r, ev) => h.recorded.push(ev),
}));

const { default: admin } = await import("../api/admin.js");
const { default: event } = await import("../api/event.js");
const call = (handler, req) =>
  new Promise((resolve) =>
    handler({ headers: {}, query: {}, ...req }, {
      setHeader() {},
      status(c) { this.c = c; return this; },
      json(b) { resolve({ status: this.c, body: b }); },
    })
  );

beforeEach(() => {
  h.authed = true;
  h.exclusions = new Set();
  h.recorded = [];
  h.vidmap = { "vid-pat-0001": "pat@example.com", "vid-alex-003": "alex@nextlevelnegotiation.com" };
  h.events = [
    { t: "2026-10-21T09:00:00Z", e: "landing_viewed", vid: "vid-pat-0001" },
    { t: "2026-10-21T09:01:00Z", e: "lead_captured", vid: "vid-pat-0001", email: "pat@example.com", flow: "apply" },
    { t: "2026-10-21T09:00:00Z", e: "landing_viewed", vid: "vid-alex-003" },
  ];
});

describe("/api/admin", () => {
  it("requires the admin session", async () => {
    h.authed = false;
    expect((await call(admin, { method: "GET" })).status).toBe(401);
  });

  it("hides excluded people from the numbers and the table", async () => {
    h.exclusions.add("@nextlevelnegotiation.com");
    const { body } = await call(admin, { method: "GET" });
    expect(body.kpis.visitors).toBe(1);
    expect(body.submissions.map((s) => s.email)).toEqual(["pat@example.com"]);
    expect(body.exclusions).toEqual(["@nextlevelnegotiation.com"]);
  });

  it("returns one person's journey when asked", async () => {
    const { body } = await call(admin, { method: "GET", query: { person: "pat@example.com" } });
    expect(body.journey.events.map((e) => e.e)).toEqual(["landing_viewed", "lead_captured"]);
    expect(body.submissions).toHaveLength(1);
  });

  it("opens an anonymous visitor's journey by their visitor key", async () => {
    h.events.push({ t: "2026-10-21T09:05:00Z", e: "results_viewed", vid: "anon-vid-0009", flow: "offer" });
    const { body } = await call(admin, { method: "GET", query: { person: "visitor:anon-vid-0009" } });
    expect(body.journey).toMatchObject({ email: null, flows: ["offer"] });
    expect(body.journey.events.map((e) => e.e)).toEqual(["results_viewed"]);
  });

  it("returns each funnel step's people for the click-through", async () => {
    const { body } = await call(admin, { method: "GET" });
    const visited = body.scriptFunnel.find((x) => x.key === "visited");
    expect(visited.people.map((p) => p.email).sort()).toEqual(["alex@nextlevelnegotiation.com", "pat@example.com"]);
  });

  it("shows session buyers who never ran an analysis, and flags sessions in the table", async () => {
    h.events.push({ t: "2026-10-21T10:00:00Z", e: "session_purchased", email: "pat@example.com", tier: "60 minutes", amount: 319 });
    h.events.push({ t: "2026-10-21T10:05:00Z", e: "session_purchased", email: "new@example.com", tier: "30 minutes", amount: 199 });
    const { body } = await call(admin, { method: "GET" });
    expect(body.purchases.map((p) => p.email)).toEqual(["new@example.com", "pat@example.com"]);
    expect(body.kpis.sessionsSold).toBe(2);
    expect(body.submissions.find((s) => s.email === "pat@example.com").boughtSession).toBe(true);
  });

  it("hides Alex's logged-in testing by default and brings it back on request", async () => {
    h.events.push({ t: "2026-10-21T11:00:00Z", e: "landing_viewed", vid: "vid-alex-003", internal: true });
    h.events.push({ t: "2026-10-21T11:05:00Z", e: "session_purchased", email: "alex@nextlevelnegotiation.com", tier: "60 minutes", amount: 319 });
    const hidden = (await call(admin, { method: "GET" })).body;
    expect(hidden.autoHidden).toEqual(["alex@nextlevelnegotiation.com"]);
    expect(hidden.purchases).toEqual([]);
    const shown = (await call(admin, { method: "GET", query: { showHidden: "1" } })).body;
    expect(shown.purchases.map((p) => p.email)).toEqual(["alex@nextlevelnegotiation.com"]);
    expect(shown.showingHidden).toBe(true);
  });

  it("adds and removes exclusions, rejecting junk", async () => {
    expect((await call(admin, { method: "POST", body: { action: "exclude", value: "Alex@NextLevelNegotiation.com" } })).body.exclusions)
      .toEqual(["alex@nextlevelnegotiation.com"]);
    expect((await call(admin, { method: "POST", body: { action: "include", value: "alex@nextlevelnegotiation.com" } })).body.exclusions).toEqual([]);
    expect((await call(admin, { method: "POST", body: { action: "exclude", value: "not an email" } })).status).toBe(400);
  });
});

describe("/api/event", () => {
  it("records the visitor and flow, and marks Alex's own browsing internal", async () => {
    h.authed = false;
    await call(event, { method: "POST", body: { event: "results_viewed", vid: "vid-pat-0001", flow: "apply" } });
    h.authed = true;
    await call(event, { method: "POST", body: { event: "results_viewed", vid: "vid-alex-003", flow: "offer" } });
    expect(h.recorded[0]).toMatchObject({ e: "results_viewed", vid: "vid-pat-0001", flow: "apply" });
    expect(h.recorded[0].internal).toBeUndefined();
    expect(h.recorded[1].internal).toBe(true);
  });

  it("refuses purchase events from the browser and junk ids", async () => {
    expect((await call(event, { method: "POST", body: { event: "script_purchased" } })).status).toBe(400);
    await call(event, { method: "POST", body: { event: "results_viewed", vid: "<script>", flow: "hacker" } });
    expect(h.recorded.at(-1).vid).toBeUndefined();
    expect(h.recorded.at(-1).flow).toBeUndefined();
  });
});
