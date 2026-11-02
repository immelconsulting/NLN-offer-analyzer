import { describe, it, expect } from "vitest";
import { splitIntoParagraphs } from "../src/lib/readableText.js";

describe("breaking up long notes", () => {
  it("groups a wall of text into two sentences at a time", () => {
    expect(splitIntoParagraphs("One here. Two here. Three here. Four here. Five here.")).toEqual([
      "One here. Two here.",
      "Three here. Four here.",
      "Five here.",
    ]);
  });

  it("keeps paragraphs the model already wrote", () => {
    expect(splitIntoParagraphs("First idea.\n\nSecond idea. With more.")).toEqual(["First idea.", "Second idea. With more."]);
  });

  it("still splits a paragraph the model left too long", () => {
    expect(splitIntoParagraphs("A one. B two. C three.\n\nD four.")).toEqual(["A one. B two.", "C three.", "D four."]);
  });

  it("doesn't break on money, decimals, abbreviations or quotes", () => {
    const text = 'A base of $155,000.50 is fine, e.g. at Acme vs. others. Say "What does the offer look like?" Then stop. Done now.';
    expect(splitIntoParagraphs(text)).toEqual([
      'A base of $155,000.50 is fine, e.g. at Acme vs. others. Say "What does the offer look like?"',
      "Then stop. Done now.",
    ]);
  });

  it("copes with nothing", () => {
    expect(splitIntoParagraphs("")).toEqual([]);
    expect(splitIntoParagraphs(undefined)).toEqual([]);
  });
});
