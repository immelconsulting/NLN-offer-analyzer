import { describe, it, expect } from "vitest";
import fs from "fs";
import { stripEmDashes } from "../api/_lib/text.js";
import { loadPrompt } from "../api/_lib/prompts.js";

// Alex's rule: no em dashes anywhere customers can see (they read as AI-written).

describe("stripEmDashes (safety net on every analysis and script)", () => {
  it("rewrites em dashes naturally", () => {
    expect(stripEmDashes("Your offer is solid — but base is low.")).toBe("Your offer is solid, but base is low.");
    expect(stripEmDashes("**Base salary** — ask for $160k")).toBe("**Base salary**: ask for $160k");
    expect(stripEmDashes("Stop here — .")).toBe("Stop here.");
    expect(stripEmDashes("a -- b")).toBe("a, b");
  });
  it("leaves en-dash ranges, markdown tables and rules alone", () => {
    const md = "| A | B |\n|---|---|\n| $90–110k | x |\n\n---";
    expect(stripEmDashes(md)).toBe(md);
  });
  it("cleans every string inside an analysis object", () => {
    const out = stripEmDashes({ score: 61, notes: ["fine — really"], nested: { why: "x — y" } });
    expect(out).toEqual({ score: 61, notes: ["fine, really"], nested: { why: "x, y" } });
  });
});

const PROMPTS = [
  "system-prompt.md",
  "script-generator-prompt.md",
  "apply-analyze-prompt.md",
  "apply-script-generator-prompt.md",
  "offer-soon-analyze-prompt.md",
  "offer-soon-script-generator-prompt.md",
];

describe("prompt files (the model mirrors their punctuation)", () => {
  it.each(PROMPTS)("%s has no em dashes and tells the model not to use them", (f) => {
    const text = loadPrompt(f);
    expect(text).not.toContain("—");
    expect(text).toMatch(/no em dashes/i);
  });
});

// Strip JS/JSX comments, so notes for developers don't count as site copy.
const withoutComments = (src) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("customer-facing site copy", () => {
  const dir = new URL("../src/", import.meta.url);
  const files = [
    ...fs.readdirSync(new URL("components/", dir)).map((f) => `components/${f}`),
    ...fs.readdirSync(new URL("lib/", dir)).map((f) => `lib/${f}`),
  ]
    .filter((f) => /\.jsx?$/.test(f))
    // The private admin page uses "—" for empty cells; customers never see it.
    .filter((f) => !/Admin/.test(f));

  it.each(files)("src/%s has no em dashes", (f) => {
    expect(withoutComments(fs.readFileSync(new URL(f, dir), "utf8"))).not.toContain("—");
  });
});
