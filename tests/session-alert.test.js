import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildClientContext } from "../api/_lib/clientContext.js";
import { sendAlert } from "../api/stripe-webhook.js";

const records = {
  "nln:sub:s1": {
    id: "s1",
    timestamp: "2026-10-14T15:00:00Z",
    form: { role: "Senior PM", company: "Acme", location: "Denver, CO", offerBaseSalary: "145,000", currentSalary: "132000", riskTolerance: "Balanced" },
    analysis: { offerScore: 65, strategies: { balanced: { name: "Balanced", expectedOutcome: "Counter at $158,000" } } },
    resumeText: "PAT EXAMPLE",
    script: "# Script",
  },
  "nln:sub:s2": {
    id: "s2",
    flow: "offer_soon",
    timestamp: "2026-10-15T15:00:00Z",
    form: { targetRole: "AE", targetCompany: "Globex", location: "Chicago", otherProcesses: "have_offer", currentTotalComp: "150000" },
    analysis: { market_range: { base: { low: 110000, target: 125000, stretch: 140000 }, total_comp: null } },
  },
};
const lists = { "nln:subs:email:pat@example.com": ["s1", "s0"], "nln:subs:email:ari@example.com": ["s2"] };
const redis = { lrange: async (k) => lists[k] || [], get: async (k) => records[k] ?? null };

describe("Jenny's session alert", () => {
  let sent;
  beforeEach(() => {
    sent = null;
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal("fetch", async (_u, o) => {
      sent = JSON.parse(o.body);
      return { ok: true };
    });
  });

  it("summarizes an offer client's latest analysis and attaches their files", async () => {
    const ctx = await buildClientContext(redis, "pat@example.com");
    await sendAlert({ amount_total: 32900, customer_details: { name: "Pat", email: "pat@example.com" } }, { label: "60 minutes" }, ctx);
    expect(sent.to).toEqual(["info@jobjenny.com"]);
    expect(sent.subject).toBe("New Strategy Session (60 minutes): Pat");
    expect(sent.text).toMatch(/Offer: \$145,000 base/);
    expect(sent.text).toMatch(/Current base salary: \$132,000/);
    expect(sent.text).toMatch(/used the analyzer 2 times/);
    expect(sent.attachments.map((a) => a.filename)).toEqual(["resume.txt", "their-script.txt"]);
  });

  it("summarizes an offer-soon client with their researched range", async () => {
    const ctx = await buildClientContext(redis, "ari@example.com");
    expect(ctx.text).toMatch(/Stage: Expecting an offer soon/);
    expect(ctx.text).toMatch(/Researched base range: \$110,000 \/ \$125,000 \/ \$140,000/);
    expect(ctx.text).toMatch(/Already has another offer in hand/);
  });

  it("says plainly when there's no analyzer history", async () => {
    const ctx = await buildClientContext(redis, "new@example.com");
    expect(ctx.text).toMatch(/No analyzer history found for new@example.com/);
    expect(ctx.attachments).toEqual([]);
  });
});
