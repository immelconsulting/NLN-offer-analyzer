import { describe, it, expect } from "vitest";
import { applyFloors, recruiterRangeCheck, wideRangeAnswer } from "../api/generate-script.js";

const range = (base, total = null) => ({ market_range: { base, total_comp: total } });
const R = (low, target, stretch) => ({ low, target, stretch });

describe("applyFloors: walk-away floors (CLAUDE.md: total comp only vs total comp)", () => {
  it("base floor is the researched base low", () => {
    expect(applyFloors({}, range(R(90000, 100000, 110000))).baseFloor).toBe(90000);
  });

  it("current total comp raises the TOTAL floor, never the base floor", () => {
    const f = applyFloors({ currentTotalComp: "150,000" }, range(R(110000, 125000, 140000), R(140000, 160000, 180000)));
    expect(f.baseFloor).toBe(110000);
    expect(f.totalFloor).toBe(150000);
    expect(f.note).toMatch(/never as their current pay/);
  });

  it("keeps the researched total low when it beats current pay", () => {
    const f = applyFloors({ currentTotalComp: "100000" }, range(R(80000, 90000, 100000), R(120000, 130000, 140000)));
    expect(f.totalFloor).toBe(120000);
    expect(f.note).toBe("");
  });

  it("drops an incoherent total floor that sits below the base floor", () => {
    const f = applyFloors({ currentTotalComp: "70000" }, range(R(90000, 100000, 110000)));
    expect(f.totalFloor).toBeNull();
    expect(f.note).toBe("");
  });

  it("copes with no researched range", () => {
    expect(applyFloors({}, { market_range: null })).toEqual({ baseFloor: null, totalFloor: null, note: "" });
  });
});

describe("recruiterRangeCheck", () => {
  const a = range(R(100000, 120000, 140000));
  it("flags a band topping out below the walk-away floor", () => {
    expect(recruiterRangeCheck({ recruiterRangeHigh: "95,000" }, a)).toMatch(/below the walk-away floor/);
  });
  it("flags a band topping out below the market target", () => {
    expect(recruiterRangeCheck({ recruiterRangeHigh: "110000" }, a)).toMatch(/below the market target/);
  });
  it("says nothing when the band reaches the target, or there's no band", () => {
    expect(recruiterRangeCheck({ recruiterRangeHigh: "125000" }, a)).toBeNull();
    expect(recruiterRangeCheck({}, a)).toBeNull();
    expect(recruiterRangeCheck({ recruiterRangeHigh: "125000" }, { market_range: null })).toBeNull();
  });
});

describe("wideRangeAnswer", () => {
  it("is null without a researched range", () => {
    expect(wideRangeAnswer({ market_range: null }, "balanced", null, null)).toBeNull();
  });
  it("hands the model resolved numbers, never asking it to compute them", () => {
    const out = wideRangeAnswer(range(R(100000, 120000, 140000)), "balanced", 100000, null);
    expect(out).toMatch(/^WIDE RANGE ANSWER: LOW = \$[\d,]+, HIGH = \$140,000/);
  });
});
