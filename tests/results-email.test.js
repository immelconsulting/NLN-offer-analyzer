import { describe, it, expect, vi, beforeEach } from "vitest";

// A tiny in-memory Redis, and a fake Resend so nothing is ever sent.
const kv = new Map();
const lists = new Map();
const fakeRedis = {
  get: async (k) => (kv.has(k) ? kv.get(k) : null),
  set: async (k, v, opts) => {
    if (opts?.nx && kv.has(k)) return null;
    kv.set(k, v);
    return "OK";
  },
  del: async (k) => kv.delete(k),
  lpush: async (k, v) => lists.set(k, [v, ...(lists.get(k) || [])]),
  rpush: async (k, v) => lists.set(k, [...(lists.get(k) || []), v]),
  lrange: async (k) => lists.get(k) || [],
  hset: async () => 1,
  hgetall: async () => ({}),
  incr: async () => 1,
  expire: async () => 1,
};
const sendEmail = vi.fn(async () => ({}));

vi.mock("../api/_lib/email.js", () => ({ sendEmail: (...a) => sendEmail(...a) }));
vi.mock("../api/_lib/rateLimit.js", () => ({ rejectIfOverLimit: async () => false }));
vi.mock("../api/_lib/store.js", async (original) => ({ ...(await original()), getRedis: () => fakeRedis }));

const { afterAnalysisSaved, requestResultsByRef, deliverResults } = await import("../api/_lib/resultsEmail.js");
const { buildClientContext } = await import("../api/_lib/clientContext.js");
const { default: handler } = await import("../api/results.js");
const { saveSubmission, getSubmission, listSubmissionIdsByEmail } = await import("../api/_lib/store.js");

function call(req) {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return handler({ headers: {}, query: {}, ...req }, res).then(() => res);
}

const offerRecord = {
  id: "sub_1",
  email: "",
  timestamp: "2026-11-01T10:00:00Z",
  form: { role: "PM", location: "Austin" },
  analysis: { offerScore: 72, scoreInterpretation: "Room to grow.", recommendedNextStep: "Email the recruiter." },
};
const applyRecord = {
  id: "sub_2",
  email: "",
  flow: "apply",
  timestamp: "2026-11-01T10:00:00Z",
  form: { targetRole: "PM", location: "Austin" },
  analysis: {
    market_range: { base: { low: 100000, target: 120000, stretch: 140000 } },
    biggest_risk: "Naming a number too early.",
    strategies: { cautious: { script: "PAYWALLED-STRATEGY-TEXT" } },
  },
};

beforeEach(() => {
  kv.clear();
  lists.clear();
  sendEmail.mockClear();
});

describe("analysis without an email", () => {
  it("saves with no email and indexes nothing under one", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    expect((await getSubmission(fakeRedis, "sub_1")).email).toBe("");
    expect([...lists.keys()].some((k) => k.includes("email:"))).toBe(false);
  });
});

describe("email asked for during the wait", () => {
  it("sends once the analysis lands, when the email came first", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    await requestResultsByRef(fakeRedis, "ref-12345678", "Pat@Example.com");
    expect(sendEmail).not.toHaveBeenCalled();
    await afterAnalysisSaved(fakeRedis, "ref-12345678", "sub_1");
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toEqual(["pat@example.com"]);
    const saved = await getSubmission(fakeRedis, "sub_1");
    expect(saved.email).toBe("pat@example.com");
    expect(await listSubmissionIdsByEmail(fakeRedis, "pat@example.com", 5)).toEqual(["sub_1"]);
  });

  it("sends straight away when the analysis came first", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    await afterAnalysisSaved(fakeRedis, "ref-12345678", "sub_1");
    expect(sendEmail).not.toHaveBeenCalled();
    await requestResultsByRef(fakeRedis, "ref-12345678", "pat@example.com");
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does nothing when nobody asked", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    await afterAnalysisSaved(fakeRedis, "ref-12345678", "sub_1");
    await afterAnalysisSaved(fakeRedis, undefined, "sub_1");
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("deliverResults", () => {
  it("sends once per address, and retries after a failed send", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    sendEmail.mockRejectedValueOnce(new Error("resend down"));
    await expect(deliverResults(fakeRedis, "sub_1", "pat@example.com")).rejects.toThrow();
    await deliverResults(fakeRedis, "sub_1", "pat@example.com");
    await deliverResults(fakeRedis, "sub_1", "pat@example.com");
    expect(sendEmail).toHaveBeenCalledTimes(2); // the failure, then one success
  });

  it("never emails the paywalled pre-offer strategies", async () => {
    await saveSubmission(fakeRedis, applyRecord);
    await deliverResults(fakeRedis, "sub_2", "pat@example.com");
    const { html, text } = sendEmail.mock.calls[0][0];
    expect(html + text).not.toContain("PAYWALLED-STRATEGY-TEXT");
    expect(text).toContain("$120,000");
  });

  it("keeps an email already on the record", async () => {
    await saveSubmission(fakeRedis, { ...offerRecord, email: "first@example.com" });
    await deliverResults(fakeRedis, "sub_1", "second@example.com");
    expect((await getSubmission(fakeRedis, "sub_1")).email).toBe("first@example.com");
    expect(sendEmail.mock.calls[0][0].to).toEqual(["second@example.com"]);
  });
});

describe("/api/results", () => {
  it("rejects a bad email without storing anything", async () => {
    const res = await call({ method: "POST", body: { email: "nope" } });
    expect(res.statusCode).toBe(400);
    expect(lists.size).toBe(0);
  });

  it("keeps the leads list shape the CSV export reads, opt-in unchecked by default", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    const res = await call({ method: "POST", body: { email: "pat@example.com", submissionId: "sub_1", flow: "offer" } });
    expect(res.statusCode).toBe(200);
    const lead = JSON.parse(lists.get("nln:leads")[0]);
    expect(lead).toMatchObject({ email: "pat@example.com", stage: "Received an offer", marketingOptIn: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("opens a results link only with the right token", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    await deliverResults(fakeRedis, "sub_1", "pat@example.com");
    const { resultsToken } = await getSubmission(fakeRedis, "sub_1");
    expect(resultsToken).toBeTruthy();
    expect(sendEmail.mock.calls[0][0].html).toContain(`/r/sub_1?t=${resultsToken}`);

    expect((await call({ method: "GET", query: { id: "sub_1", t: "wrong" } })).statusCode).toBe(404);
    expect((await call({ method: "GET", query: { id: "sub_1" } })).statusCode).toBe(404);
    const ok = await call({ method: "GET", query: { id: "sub_1", t: resultsToken } });
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ flow: "offer", analysis: { submissionId: "sub_1", offerScore: 72 } });
    expect(JSON.stringify(ok.body)).not.toContain("pat@example.com");
  });

  it("won't open a record that never had a link", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    expect((await call({ method: "GET", query: { id: "sub_1", t: "undefined" } })).statusCode).toBe(404);
  });
});

describe("Jenny's alert finds the analysis by id", () => {
  it("uses the payment's analysis even with a different checkout email", async () => {
    await saveSubmission(fakeRedis, offerRecord);
    const ctx = await buildClientContext(fakeRedis, "other@example.com", { submissionId: "sub_1" });
    expect(ctx.text).toContain("PM");
    expect(ctx.text).not.toContain("No analyzer history");
  });

  it("falls back to the email when there's no reference", async () => {
    await saveSubmission(fakeRedis, { ...offerRecord, email: "pat@example.com" });
    const ctx = await buildClientContext(fakeRedis, "pat@example.com");
    expect(ctx.text).toContain("PM");
  });

  it("says so when neither finds anything", async () => {
    const ctx = await buildClientContext(fakeRedis, "new@example.com", { submissionId: "sub_missing" });
    expect(ctx.text).toContain("No analyzer history");
  });
});
