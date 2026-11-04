import { describe, it, expect } from "vitest";
import fs from "fs";
import { cleanForCustomers, stripEmDashes } from "../api/_lib/text.js";
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

// Jenny's rule: "value headline" is jargon. Customers see "Your one-line case
// for why you're worth more" as a header and "your one-line pitch" in sentences.
const JARGON = /value[\s-]*headline/i;

describe('no "value headline" anywhere customers can see', () => {
  it.each(PROMPTS)("%s doesn't use it", (f) => {
    expect(loadPrompt(f)).not.toMatch(JARGON);
  });

  const src = new URL("../src/", import.meta.url);
  const siteFiles = ["components", "lib"].flatMap((d) =>
    fs.readdirSync(new URL(`${d}/`, src)).filter((f) => /\.jsx?$/.test(f)).map((f) => new URL(`${d}/${f}`, src))
  );
  const serverFiles = ["scriptJob.js", "scriptMessages.js", "email.js", "clientContext.js", "resultsEmail.js"].map(
    (f) => new URL(`../api/_lib/${f}`, import.meta.url)
  );
  it.each([...siteFiles, ...serverFiles].map((u) => [u.pathname.split("/").slice(-2).join("/"), u]))("%s doesn't use it", (_, u) => {
    expect(withoutComments(fs.readFileSync(u, "utf8"))).not.toMatch(JARGON);
  });

  it("rewrites it in scripts and analyses that still have it", () => {
    expect(cleanForCustomers("## 4. Sharing your value headline")).toBe("## 4. Your one-line case for why you're worth more");
    expect(cleanForCustomers("### Value Headline")).toBe("### Your one-line case for why you're worth more");
    expect(cleanForCustomers("Start with your value headline, then pause.")).toBe("Start with your one-line pitch, then pause.");
    expect(cleanForCustomers("**Value headline:** say it")).toBe("**One-line pitch:** say it");
    expect(cleanForCustomers({ notes: ["a value-headline"] })).toEqual({ notes: ["a one-line pitch"] });
  });
  it("still removes em dashes, and leaves other text alone", () => {
    expect(cleanForCustomers("Solid — but low.")).toBe("Solid, but low.");
    expect(cleanForCustomers("## The value you bring")).toBe("## The value you bring");
  });
});
