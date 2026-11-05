import { describe, it, expect } from "vitest";
import fs from "fs";

const read = (f) => fs.readFileSync(new URL(`../src/components/${f}`, import.meta.url), "utf8");

describe("landing page", () => {
  const landing = read("LandingPage.jsx");
  it("puts the stage choice first and the Trustpilot link below it, in a new tab", () => {
    const link = landing.indexOf("href={TRUSTPILOT_REVIEWS_URL}");
    expect(link).toBeGreaterThan(landing.indexOf("STAGES.map"));
    expect(landing.slice(link, link + 120)).toContain('target="_blank"');
    expect(landing.slice(link, link + 120)).toContain('rel="noopener noreferrer"');
  });
  it("says whose reviews they are", () => {
    expect(landing).toContain("Reviews of Next Level Negotiation (NLN)");
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
