import { describe, it, expect, vi, beforeEach } from "vitest";

// Fakes for every outside service: Redis, Stripe, Resend and Claude.
const h = vi.hoisted(() => ({
  db: new Map(),
  records: {},
  payment: { paid: true, session: {} },
  emails: [],
  modelCalls: 0,
  lastSystem: "",
  lastMessage: "",
  events: [],
  background: [],
  failModel: 0,
  alerts: [],
  modelText: null,
}));

vi.mock("../api/_lib/store.js", () => ({
  eventDay: () => "2026-10-21",
  getRedis: () => ({
    rpush: async (_k, v) => h.events.push(JSON.parse(v)),
    expire: async () => {},
    hset: async () => {},
    del: async (k) => h.db.delete(k),
    incr: async (k) => {
      const n = (h.db.has(k) ? JSON.parse(h.db.get(k)) : 0) + 1;
      h.db.set(k, JSON.stringify(n));
      return n;
    },
    get: async (k) => (h.db.has(k) ? JSON.parse(h.db.get(k)) : null),
    set: async (k, v, o = {}) => {
      if (o.nx && h.db.has(k)) return null;
      h.db.set(k, JSON.stringify(v));
      return "OK";
    },
  }),
  getSubmission: async (_r, id) => h.records[id] || null,
  updateSubmission: async () => {},
  attachEmail: async (_r, id) => h.records[id] || null,
}));
vi.mock("../api/_lib/payment.js", () => ({ verifyPayment: async () => h.payment }));
vi.mock("../api/_lib/email.js", () => ({
  sendScriptEmail: async (a) => {
    if (h.failEmail) throw new Error("resend down");
    h.emails.push(a);
  },
  sendEmail: async (a) => h.alerts.push(a),
}));
vi.mock("@vercel/functions", () => ({ waitUntil: (p) => h.background.push(p) }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      create: async (p) => {
        h.modelCalls += 1;
        h.lastSystem = p.system;
        h.lastMessage = p.messages[0].content;
        await h.hold;
        if (h.failModel > 0) {
          h.failModel -= 1;
          throw new Error("model down");
        }
        return { content: [{ type: "text", text: h.modelText || `# Script ${h.modelCalls}` }], usage: {}, stop_reason: "end_turn" };
      },
    };
  },
}));

process.env.ANTHROPIC_API_KEY = "test";
const { default: handler } = await import("../api/generate-script.js");

const ask = (body) =>
  new Promise((resolve) =>
    handler(
      { method: "POST", body },
      { setHeader() {}, status(c) { this.c = c; return this; }, json(b) { resolve({ status: this.c, body: b }); } }
    )
  );

// Lets the background work finish, as if the function kept running.
const settle = async () => {
  while (h.background.length) await h.background.shift();
};

// One visit to the script page: asks, waits for the job, and asks again.
const call = async (body) => {
  const first = await ask(body);
  if (first.body?.status !== "generating") return first;
  await settle();
  return ask({ ...body, waited: true });
};

const offerForm = { role: "PM", company: "Acme", location: "Denver, CO", offerBaseSalary: "145,000" };
const applyForm = { targetRole: "Analyst", location: "Remote" };

beforeEach(() => {
  h.db.clear();
  h.records = {};
  h.payment = { paid: true, session: { customer_details: { email: "buyer@example.com" } } };
  h.emails.length = 0;
  h.events.length = 0;
  h.modelCalls = 0;
  h.background.length = 0;
  h.failModel = 0;
  h.alerts.length = 0;
  h.modelText = null;
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
    const r = await call({ sessionId: "test_skip_payment", form: offerForm, analysis: {} });
    expect(r.body.script).toBe("# Script 1");
    expect(h.emails).toHaveLength(0);
    expect((await call({ sessionId: "test_skip_payment" })).status).toBe(404);
  });

  it("a test run on a saved analysis uses the job, without emailing or recording a sale", async () => {
    const body = { sessionId: "test_skip_payment", form: offerForm, analysis: { submissionId: "sub_T" } };
    expect((await ask(body)).body.status).toBe("generating");
    await settle();
    expect((await ask({ ...body, waited: true })).body.script).toBe("# Script 1");
    expect(h.emails).toHaveLength(0);
    expect(h.events.filter((e) => e.e === "script_purchased")).toHaveLength(0);
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

describe("the paid script survives the buyer's browser", () => {
  const body = { sessionId: "cs_job", form: offerForm, analysis: {} };

  it("answers straight away and finishes in the background, even if they never ask again", async () => {
    expect((await ask(body)).body.status).toBe("generating");
    expect(h.emails).toHaveLength(0);
    await settle(); // the tab is gone; nothing else ever calls
    expect(h.emails).toHaveLength(1);
    expect(h.db.has("nln:script:cs_job")).toBe(true);
    expect(h.db.has("nln:script-job:cs_job")).toBe(false);
  });

  it("a refresh mid-write joins the running job instead of starting another", async () => {
    let finishWriting;
    h.hold = new Promise((resolve) => {
      finishWriting = resolve;
    });
    await ask(body);
    const refreshed = await ask(body);
    const otherDevice = await ask({ sessionId: "cs_job" });
    expect(refreshed.body.status).toBe("generating");
    expect(otherDevice.body.status).toBe("generating");
    finishWriting();
    h.hold = null;
    await settle();
    expect(h.modelCalls).toBe(1);
    expect(h.emails).toHaveLength(1);
  });

  it("doesn't ask Stripe again while a job is running", async () => {
    await ask(body);
    h.payment = { paid: false, status: 402, error: "should not be asked" };
    expect((await ask(body)).status).toBe(200);
  });

  it("tells someone who waited where it went, but not a later visitor to the link", async () => {
    expect((await call(body)).body.emailedTo).toBe("buyer@example.com");
    const later = await ask({ sessionId: "cs_job" });
    expect(later.body.reopened).toBe(true);
    expect(later.body.emailedTo).toBeUndefined();
  });
});

describe("when writing fails after payment", () => {
  const body = { sessionId: "cs_fail", form: offerForm, analysis: {} };

  it("retries by itself without bothering anyone", async () => {
    h.failModel = 1;
    const r = await call(body);
    expect(r.body.script).toBe("# Script 2");
    expect(h.alerts).toHaveLength(0);
  });

  it("emails Alex once after the retry fails, and the next check tries again", async () => {
    h.failModel = 2;
    await ask(body);
    await settle();
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0].to).toEqual(["alex@nextlevelnegotiation.com"]);
    expect(h.alerts[0].text).toContain("buyer@example.com");
    expect(h.alerts[0].text).toContain("session_id=cs_fail");
    const next = await call({ ...body, waited: true });
    expect(next.body.script).toBeTruthy();
    expect(h.emails).toHaveLength(1);
    expect(h.alerts).toHaveLength(1);
  });

  it("stops after three runs with a reassuring message, and Try Again gets another go", async () => {
    h.failModel = 6;
    for (let i = 0; i < 3; i += 1) {
      await ask(body);
      await settle();
    }
    const stopped = await ask(body);
    expect(stopped.body.status).toBe("failed");
    expect(stopped.body.error).toMatch(/payment is safe/);
    expect(h.alerts).toHaveLength(1);
    expect(h.modelCalls).toBe(6);
    const retried = await call({ ...body, retry: true });
    expect(retried.body.script).toBeTruthy();
  });

  it("alerts Alex if the script is written but the email can't be sent", async () => {
    h.failEmail = true;
    await call(body);
    expect(h.alerts).toHaveLength(1);
    expect(h.alerts[0].text).toMatch(/emailing it to the buyer failed/);
    h.failEmail = false;
  });
});

describe("the free preview", () => {
  const record = { id: "sub_P", form: offerForm, analysis: { offerScore: 70 } };
  const askPreview = (submissionId = "sub_P") => ask({ preview: true, submissionId });

  beforeEach(() => {
    h.records.sub_P = record;
    h.modelText = "## A Note From Alex\n\nHi.";
  });

  it("writes only the opening, once per analysis; reloading makes no new model call", async () => {
    expect((await askPreview()).body.status).toBe("generating");
    expect((await askPreview()).body.status).toBe("generating"); // a reload mid-write
    await settle();
    const ready = await askPreview();
    expect(ready.body).toMatchObject({ status: "ready", preview: "## A Note From Alex\n\nHi.", flow: "offer" });
    expect(ready.body.headings).toContain("Delivering your counter");
    await askPreview();
    expect(h.modelCalls).toBe(1);
    expect(h.lastMessage).toContain("PREVIEW ONLY");
  });

  it("stops at the first spoken line, even if the model keeps going", async () => {
    h.modelText = "## Intro\n\nHi.\n\n## Script\n\n**Option A:** 🗣️ \"First line.\"\n\n**Option B:** 🗣️ \"Paid line.\"\n\n## More";
    await askPreview();
    await settle();
    const ready = await askPreview();
    expect(ready.body.preview).toBe("## Intro\n\nHi.\n\n## Script\n\n**Option A:** 🗣️ \"First line.\"");
    expect(h.lastMessage).toContain("stop immediately after the first line marked 🗣️");
  });

  it("the screening script stops at the question and never shows an answer", async () => {
    h.records.sub_S = { id: "sub_S", flow: "apply", form: applyForm, analysis: { market_range: null } };
    h.modelText = '## 5. The Script\n\n### Q: "What are your salary expectations?"\n\n**Option A:** 🗣️ "Paid answer."';
    await askPreview("sub_S");
    await settle();
    const ready = await askPreview("sub_S");
    expect(ready.body.preview).toBe('## 5. The Script\n\n### Q: "What are your salary expectations?"');
    expect(ready.body.preview).not.toContain("🗣");
    expect(h.lastMessage).toContain('stop immediately after the line that asks "What are your salary expectations?"');
    expect(ready.body.headings[0]).toBe("Your word-for-word answers to the salary question");
  });

  it("stops short of the response when the recruiter told them the number", async () => {
    h.records.sub_T = { id: "sub_T", flow: "interview", form: { ...applyForm, salaryStage: "told_number" }, analysis: { market_range: null } };
    h.modelText = '### When the recruiter already told you the number\n\nThey spoke first.\n\n🗣️ "Paid response."\n\n### Q: "What are your salary expectations?"';
    await askPreview("sub_T");
    await settle();
    const ready = await askPreview("sub_T");
    expect(ready.body.preview).toBe("### When the recruiter already told you the number\n\nThey spoke first.");
    expect(ready.body.headings[0]).toBe("How to respond to the number they told you");
  });

  it("only runs on a saved analysis, so nobody can spend model calls on made-up input", async () => {
    expect((await askPreview("sub_nope")).body.status).toBe("none");
    expect((await ask({ preview: true })).body.status).toBe("none");
    expect((await ask({ preview: true, submissionId: "sub_nope", form: offerForm, analysis: {} })).body.status).toBe("none");
    expect(h.modelCalls).toBe(0);
  });

  it("goes quiet when it fails, without retrying on every reload", async () => {
    h.failModel = 1;
    await askPreview();
    await settle();
    expect((await askPreview()).body.status).toBe("none");
    await askPreview();
    expect(h.modelCalls).toBe(1);
  });

  it("never needs a payment and never hands over the rest", async () => {
    h.payment = { paid: false, status: 402, error: "unpaid" };
    await askPreview();
    await settle();
    const ready = await askPreview();
    expect(ready.status).toBe(200);
    expect(ready.body.script).toBeUndefined();
  });

  it("the paid script shows the preview right away, then continues from it as one piece", async () => {
    await askPreview();
    await settle();
    h.modelText = "## Opening and rapport\n\nHello.";
    h.payment.session.client_reference_id = "sub_P";
    const waiting = await ask({ sessionId: "cs_prev" });
    expect(waiting.body).toMatchObject({ status: "generating", preview: "## A Note From Alex\n\nHi." });
    await settle();
    expect(h.lastMessage).toContain("THE OPENING IS ALREADY WRITTEN");
    expect(h.lastMessage).toContain("## A Note From Alex");
    expect(h.lastMessage).toContain("Continue from exactly where it stops");
    expect(h.modelCalls).toBe(2);
    const done = await ask({ sessionId: "cs_prev", waited: true });
    expect(done.body.script).toBe("## A Note From Alex\n\nHi.\n\n## Opening and rapport\n\nHello.");
    expect(h.emails[0].script).toBe(done.body.script);
  });

  it("writes the whole script as before when there's no preview", async () => {
    h.modelText = null;
    h.payment.session.client_reference_id = "sub_P";
    await call({ sessionId: "cs_nopreview" });
    expect(h.lastMessage).not.toContain("THE OPENING IS ALREADY WRITTEN");
  });
});

describe("Stripe's webhook starts the script for someone who never comes back", () => {
  const paid = { id: "cs_hook", client_reference_id: "sub_W", customer_details: { email: "gone@example.com" } };

  it("writes and emails it with no browser involved, then the page finds it", async () => {
    const { startScriptFromPayment } = await import("../api/_lib/scriptJob.js");
    const { getRedis } = await import("../api/_lib/store.js");
    h.records.sub_W = { id: "sub_W", form: offerForm, analysis: {} };
    expect(await startScriptFromPayment(getRedis(), paid)).toBe(true);
    await settle();
    expect(h.emails[0].to).toBe("gone@example.com");
    h.payment.session = paid;
    expect((await ask({ sessionId: "cs_hook" })).body.script).toBe("# Script 1");
    expect(h.modelCalls).toBe(1);
  });

  it("does nothing without an analysis to work from", async () => {
    const { startScriptFromPayment } = await import("../api/_lib/scriptJob.js");
    const { getRedis } = await import("../api/_lib/store.js");
    expect(await startScriptFromPayment(getRedis(), { id: "cs_x" })).toBe(false);
    expect(await startScriptFromPayment(getRedis(), { id: "cs_x", client_reference_id: "sub_none" })).toBe(false);
    expect(h.modelCalls).toBe(0);
  });
});

describe("what each salary-question answer tells the script", () => {
  const applyBody = (form) => ({ sessionId: "test_skip_payment", flow: "apply", form: { ...applyForm, ...form }, analysis: { market_range: null } });

  it("told_number passes the figure and opens from it", async () => {
    await call(applyBody({ salaryStage: "told_number", toldNumber: "$95,000 to $110,000" }));
    expect(h.lastMessage).toContain("$95,000 to $110,000");
    expect(h.lastMessage).toContain("When the recruiter already told you the number");
  });

  it("not_asked opens from that", async () => {
    await call(applyBody({ salaryStage: "not_asked" }));
    expect(h.lastMessage).toContain("When the question has not come up");
  });

  it("the others carry neither", async () => {
    await call(applyBody({ salaryStage: "no_call" }));
    expect(h.lastMessage).not.toContain("When the recruiter already told you");
    expect(h.lastMessage).not.toContain("When the question has not come up");
  });
});
