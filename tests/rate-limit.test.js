import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ counts: new Map(), admin: false, down: false }));
vi.mock("../api/_lib/store.js", () => ({
  getRedis: () => ({
    incr: async (k) => {
      if (h.down) throw new Error("redis down");
      h.counts.set(k, (h.counts.get(k) || 0) + 1);
      return h.counts.get(k);
    },
    expire: async () => {},
  }),
}));
vi.mock("../api/_lib/auth.js", () => ({ isAuthorized: () => h.admin }));

const { rejectIfOverLimit, DAILY_LIMITS } = await import("../api/_lib/rateLimit.js");
const req = (ip) => ({ headers: { "x-real-ip": ip } });
const res = () => ({ status(c) { this.c = c; return this; }, json(b) { this.b = b; } });

beforeEach(() => {
  h.counts.clear();
  h.admin = false;
  h.down = false;
});

describe("daily limits", () => {
  it("allows 10 analyses a day per visitor, then blocks with a friendly message", async () => {
    expect(DAILY_LIMITS.analysis).toBe(10);
    for (let i = 0; i < 10; i++) expect(await rejectIfOverLimit(req("1.1.1.1"), res(), "analysis")).toBe(false);
    const r = res();
    expect(await rejectIfOverLimit(req("1.1.1.1"), r, "analysis")).toBe(true);
    expect(r.c).toBe(429);
    expect(r.b.error).toMatch(/today's limit of 10 analyses/);
  });

  it("counts each visitor separately", async () => {
    for (let i = 0; i < 10; i++) await rejectIfOverLimit(req("1.1.1.1"), res(), "analysis");
    expect(await rejectIfOverLimit(req("2.2.2.2"), res(), "analysis")).toBe(false);
  });

  it("never limits a logged-in admin", async () => {
    h.admin = true;
    for (let i = 0; i < 15; i++) expect(await rejectIfOverLimit(req("1.1.1.1"), res(), "analysis")).toBe(false);
  });

  it("lets requests through if the database is down", async () => {
    h.down = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await rejectIfOverLimit(req("1.1.1.1"), res(), "analysis")).toBe(false);
  });
});
