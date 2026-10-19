import { describe, it, expect, vi, beforeEach } from "vitest";

// Fakes for every outside service: Redis, Stripe, Resend and Claude.
const h = vi.hoisted(() => ({
  db: new Map(),
  records: {},
  payment: { paid: true, session: {} },
  emails: [],
  modelCalls: 0,
  lastSystem: "",
  events: [],
}));

vi.mock("../api/_lib/store.js", () => ({
  eventDay: () => "2026-10-21",
  getRedis: () => ({
    rpush: async (_k, v) => h.events.push(JSON.parse(v)),
    expire: async () => {},
    hset: async () => {},
    get: async (k) => (h.db.has(k) ? JSON.parse(h.db.get(k)) : null),
    set: async (k, v, o = {}) => {
      if (o.nx && h.db.has(k)) return null;
      h.db.set(k, JSON.stringify(v));
      return "OK";
    },
  }),
  getSubmission: async (_r, id) => h.records[id] || null,
  updateSubmission: async () => {},
}));
vi.mock("../api/_lib/payment.js", () => ({ verifyPayment: async () => h.payment }));
vi.mock("../api/_lib/email.js", () => ({ sendScriptEmail: async (a) => h.emails.push(a) }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (p) => {
        h.modelCalls += 1;
        h.lastSystem = p.system;
        return { content: [{ type: "text", text: `# Script ${h.modelCalls}` }] };
      },
    };
  },
}));

process.env.ANTHROPIC_API_KEY = "test";
const { default: handler } = await import("../api/generate-script.js");

const call = (body) =>
  new Promise((resolve) =>
    handler(
      { method: "POST", body },
      { setHeader() {}, status(c) { this.c = c; return this; }, json(b) { resolve({ status: this.c, body: b }); } }
    )
  );

const offerForm = { role: "PM", company: "Acme", location: "Denver, CO", offerBaseSalary: "145,000" };
const applyForm = { targetRole: "Analyst", location: "Remote" };

beforeEach(() => {
  h.db.clear();
  h.records = {};
  h.payment = { paid: true, session: { customer_details: { email: "buyer@example.com" } } };
  h.emails.length = 0;
  h.events.length = 0;
  h.modelCalls = 0;
});

describe("one payment = one script", () => {
  it("writes, saves and emails the first time", async () => {
    const r = await call({ sessionId: "cs_1", form: offerForm, analysis: {} });
    expect(r.status).toBe(200);
    expect(r.body.emailedTo).toBe("buyer@example.com");
    expect(h.emails[0].scriptUrl).toBe("https://www.jobofferanalyzer.com/script?session_id=cs_1");
  });

  it("returns the saved script on reload and on another device, with no new model call or email", async () => {
    await call({ sessionId: "cs_1", form: offerForm, analysis: {} });
    const reload = await call({ sessionId: "cs_1", form: offerForm, analysis: {} });
    const otherDevice = await call({ sessionId: "cs_1" });
    expect(reload.body).toMatchObject({ script: "# Script 1", reopened: true });
    expect(otherDevice.body.script).toBe("# Script 1");
    expect(h.modelCalls).toBe(1);
    expect(h.emails).toHaveLength(1);
  });

  it("records the sale once for the dashboard, on the person's analyzer email", async () => {
    h.records.sub_A = { id: "sub_A", email: "pat@example.com", form: offerForm, analysis: {} };
    h.payment.session = { client_reference_id: "sub_A", amount_total: 4700, customer_details: { email: "pat.stripe@example.com", name: "Pat" } };
    await call({ sessionId: "cs_sale", vid: "vid-pat-0001" });
    await call({ sessionId: "cs_sale" });
    const sales = h.events.filter((e) => e.e === "script_purchased");
    expect(sales).toHaveLength(1);
    expect(sales[0]).toMatchObject({ email: "pat@example.com", amount: 4700, flow: "offer", vid: "vid-pat-0001" });
  });

  it("never saves or emails the shared test session", async () => {
    await call({ sessionId: "test_skip_payment", form: offerForm, analysis: {} });
    expect(h.emails).toHaveLength(0);
    expect((await call({ sessionId: "test_skip_payment" })).status).toBe(404);
  });
});

describe("the payment's analysis reference (client_reference_id)", () => {
  it("lets a buyer on another device get their script with nothing in the browser", async () => {
    h.records.sub_A = { id: "sub_A", form: offerForm, analysis: {} };
    h.payment.session.client_reference_id = "sub_A";
    const r = await call({ sessionId: "cs_2" });
    expect(r.status).toBe(200);
    expect(r.body.subtitle).toBe("PM at Acme · Denver, CO");
  });

  it("beats a stale browser copy from a different analysis", async () => {
    h.records.sub_B = { id: "sub_B", flow: "apply", form: applyForm, analysis: { market_range: null } };
    h.payment.session.client_reference_id = "sub_B";
    const r = await call({ sessionId: "cs_3", flow: "offer", form: offerForm, analysis: {} });
    expect(r.body.flow).toBe("apply");
  });

  it("falls back to the browser copy for older payments", async () => {
    const r = await call({ sessionId: "cs_4", flow: "offer", form: offerForm, analysis: {} });
    expect(r.status).toBe(200);
  });

  it("is a clear 404 with no reference and no browser copy", async () => {
    expect((await call({ sessionId: "cs_5" })).status).toBe(404);
  });
});

describe("payment and prompts", () => {
  it("refuses an unpaid session", async () => {
    h.payment = { paid: false, status: 402, error: "This payment hasn't been completed." };
    expect((await call({ sessionId: "cs_6", form: offerForm, analysis: {} })).status).toBe(402);
    expect(h.modelCalls).toBe(0);
  });

  it("uses the real prompt with the session link filled in", async () => {
    await call({ sessionId: "cs_7", form: offerForm, analysis: {} });
    expect(h.lastSystem.length).toBeGreaterThan(5000);
    expect(h.lastSystem).toContain("https://www.jobofferanalyzer.com/session");
    expect(h.lastSystem).not.toContain("{{strategy_session_url}}");
  });
});
