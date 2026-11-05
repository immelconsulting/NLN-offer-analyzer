import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { previewSections } from "../src/lib/scriptPreview.js";
import { remainingHeadings } from "../api/_lib/scriptJob.js";

vi.mock("../src/lib/track.js", () => ({ track: vi.fn() }));
const { default: ScriptPreview } = await import("../src/components/ScriptPreview.jsx");

describe("previewSections", () => {
  it("separates headers from the text under them", () => {
    expect(previewSections("Hello.\n\n## Note\n\nHi.\n\n| a |\n|---|\n| b |\n\n## Opening\n\n🗣️ \"Line.\"")).toEqual([
      { heading: null, body: "Hello." },
      { heading: "## Note", body: "Hi.\n\n| a |\n|---|\n| b |" },
      { heading: "## Opening", body: "🗣️ “Line.”" },
    ]);
  });
  it("adds every section still to be written, with nothing real under it", () => {
    expect(previewSections("## Note\n\nHi.", ["Closing"])).toEqual([
      { heading: "## Note", body: "Hi." },
      { heading: "## Closing", body: "", placeholder: true },
    ]);
  });
  it("gives the screening question something under it, without a gap under its parent", () => {
    expect(previewSections('## The Script\n\n### Q: "What are your salary expectations?"')).toEqual([
      { heading: "## The Script", body: "" },
      { heading: "### Q: “What are your salary expectations?”", body: "", placeholder: true },
    ]);
  });
});

describe("the preview on the page", () => {
  const preview = `## A Note From Alex\n\nI'm Alex Immel, founder and CEO of NLN. SECRET-INTRO\n\n## Opening\n\n🗣️ "SECRET-LINE"`;
  const headings = remainingHeadings("offer");
  const html = renderToStaticMarkup(
    createElement(ScriptPreview, { state: { status: "ready", preview, headings }, onUnlock: () => {}, onDetails: () => {} })
  );
  const doc = html.replace(/&#x27;/g, "'");
  const blurred = doc.match(/<div data-blurred[\s\S]*?<\/div>/g);
  const clear = doc.replace(/<div data-blurred[\s\S]*?<\/div>/g, "");

  it("shows the opening and every header in the clear", () => {
    for (const h of ["A Note From Alex", "Opening", ...headings]) expect(clear).toContain(h.replace("'", "’"));
    expect(clear).toContain("Your one-line case for why you’re worth more");
    expect(clear).toContain("SECRET-INTRO");
    expect(clear).toContain("SECRET-LINE");
  });
  it("blurs placeholder text under every later section, and nothing real", () => {
    expect(clear).not.toContain("Lorem");
    expect(blurred).toHaveLength(headings.length);
    expect(blurred.join("")).not.toContain("SECRET");
    for (const b of blurred) expect(b).toContain("blur-");
  });
  it("has an unlock button above and below, both out of the blur", () => {
    expect(clear.match(/Unlock your full script, \$47/g)).toHaveLength(2);
    expect(clear).toContain("See what you get for $47");
  });
});

describe("Alex's section and the script's own intro", () => {
  it("the page doesn't repeat the opening's introduction of Alex", () => {
    expect(previewSections("## Note\n\nI'm Alex Immel, founder and CEO of NLN. You have a solid offer.")[0].body).toBe("You have a solid offer.");
    expect(previewSections("## Note\n\nHi, I’m Alex.")[0].body).toBe("");
    expect(previewSections("## Note\n\nYou have a solid offer from Alex's team.")[0].body).toBe("You have a solid offer from Alex’s team.");
  });
  it("shows his section, then a headline into their script, and hides neither button", () => {
    const html = renderToStaticMarkup(
      createElement(ScriptPreview, { state: { status: "ready", preview: "## N\n\nHello", headings: [] }, onUnlock: () => {} })
    );
    expect(html.indexOf("Hi, I")).toBeGreaterThan(-1);
    expect(html.indexOf("Hi, I")).toBeLessThan(html.indexOf("get to your script"));
    expect(html).toContain("alex-headshot");
  });
  it("never claims the AI is trained on or built from NLN material", () => {
    const source = fs.readFileSync(new URL("../src/components/AlexIntro.jsx", import.meta.url), "utf8");
    const bio = source.slice(source.indexOf("const BIO"));
    expect(bio).not.toMatch(/trained on|built on hundreds|draws on what worked/i);
    expect(bio).toMatch(/uses AI, guided by/);
  });
  it("sets spoken lines apart from advice", () => {
    const html = renderToStaticMarkup(createElement(ScriptPreview, { state: { status: "ready", preview: '## N\n\nAdvice here.\n\n🗣️ "Say this."', headings: [] }, onUnlock: () => {} }));
    expect(html).toMatch(/<p [^>]*border-l-4[^>]*>🗣️ “Say this.”<\/p>/);
    expect(html).toMatch(/<p [^>]*text-slate-800 leading-relaxed mb-4[^>]*>Advice here.<\/p>/);
  });
});
