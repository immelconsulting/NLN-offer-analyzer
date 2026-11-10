import { describe, it, expect } from "vitest";
import fs from "fs";
import { curlyQuotes, plainSourceNames } from "../src/lib/readableText.js";
import { cleanForCustomers } from "../api/_lib/text.js";
import { loadPrompt } from "../api/_lib/prompts.js";

const read = (f) => fs.readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8");

describe("landing page", () => {
  const landing = read("LandingPage.jsx");
  it("puts the stage choice first and the Trustpilot link below it, in a new tab", () => {
    const link = landing.indexOf("href={TRUSTPILOT_REVIEWS_URL}");
    expect(link).toBeGreaterThan(landing.indexOf("STAGES.map"));
    expect(landing.slice(link, link + 120)).toContain('target="_blank"');
    expect(landing.slice(link, link + 120)).toContain('rel="noopener noreferrer"');
  });
  it("names Alex in the AI line, and his name opens the bio", () => {
    expect(landing).not.toContain("Reviews of Next Level Negotiation (NLN)");
    expect(landing).toMatch(/This tool uses AI, guided by\{" "\}\s*<WhoIsBehindThis[^>]*>Alex Immel<\/WhoIsBehindThis>\s*'s Next Level Negotiation methodology/);
  });
});

describe("resume upload", () => {
  it.each(["ApplyForm.jsx", "OfferForm.jsx", "OfferSoonForm.jsx"])("%s carries the privacy note", (f) => {
    expect(read(f)).toContain("<ResumePrivacyNote />");
  });
  it("is honest that the text is kept, and only the file isn't", () => {
    const note = read("ResumePrivacyNote.jsx").replace(/\s+/g, " ");
    expect(note).toContain("we save that text (not your file)");
  });
});

describe("plain-English sources", () => {
  it.each([
    ["BLS OEWS", "U.S. Bureau of Labor Statistics wage data"],
    ["BLS", "U.S. Bureau of Labor Statistics wage data"],
    ["The BLS median is $90k", "The U.S. Bureau of Labor Statistics median is $90k"],
    ["Bureau of Labor Statistics", "U.S. Bureau of Labor Statistics wage data"],
    ["The BLS OEWS data puts it at $90k", "U.S. Bureau of Labor Statistics wage data puts it at $90k"],
    ["OEWS", "U.S. Bureau of Labor Statistics wage data"],
  ])("%s", (from, to) => {
    expect(plainSourceNames(from)).toBe(to);
  });
  it("leaves URLs and other sources alone, on new analyses too", () => {
    const source = { name: "Levels.fyi", url: "https://www.bls.gov/oes/current/oes_nat.htm" };
    expect(cleanForCustomers(source)).toEqual(source);
    expect(cleanForCustomers({ name: "BLS OEWS" }).name).toBe("U.S. Bureau of Labor Statistics wage data");
  });
});

describe("curly quotes", () => {
  it("curls, and fixes doubled or missing quotes on a spoken line", () => {
    expect(curlyQuotes('🗣️ "I\'m excited."')).toBe("🗣️ “I’m excited.”");
    expect(curlyQuotes('🗣️ ""Doubled.""')).toBe("🗣️ “Doubled.”");
    expect(curlyQuotes('🗣️ “"Mixed."”')).toBe("🗣️ “Mixed.”");
    expect(curlyQuotes('🗣️ "No end.')).toBe("🗣️ “No end.”");
    expect(curlyQuotes('🗣️ No start."')).toBe("🗣️ “No start.”");
    expect(curlyQuotes('**Option A:** 🗣️ "Line."')).toBe("**Option A:** 🗣️ “Line.”");
    expect(curlyQuotes("| a | b |\n|---|---|")).toBe("| a | b |\n|---|---|");
  });
});

describe("results copy Marian flagged", () => {
  const ALL = ["ApplyResultsPage.jsx", "OfferSoonResultsPage.jsx", "RangeBlocks.jsx"].map(read).join("\n");
  it("never tells them what to walk away from", () => {
    expect(ALL).not.toMatch(/worth your time|Your walk-away floor/i);
    expect(ALL).toContain("Where you set your own floor is up to you.");
  });
  it("leads with the benefit", () => {
    expect(read("ApplyResultsPage.jsx")).toContain("Know Your Number Before the Recruiter Asks.");
    expect(ALL).not.toContain("doesn't start at the offer");
  });
  it.each(["apply-analyze-prompt.md", "offer-soon-analyze-prompt.md", "system-prompt.md"])("%s writes in second person with plain sources", (f) => {
    const prompt = loadPrompt(f);
    expect(prompt).toMatch(/second person/);
    expect(prompt).toMatch(/U\.S\. Bureau of Labor Statistics wage data/);
  });
  it.each(["apply-analyze-prompt.md", "offer-soon-analyze-prompt.md"])("%s treats the floor as theirs", (f) => {
    const prompt = loadPrompt(f);
    expect(prompt).not.toMatch(/walk-away floor|worth your time/i);
    expect(prompt).toMatch(/Where they set their own floor is up to them/);
  });
});
