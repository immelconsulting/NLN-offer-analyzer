import { describe, it, expect } from "vitest";
import { loadPrompt } from "../api/_lib/prompts.js";

const ALL = [
  "system-prompt.md",
  "script-generator-prompt.md",
  "apply-analyze-prompt.md",
  "apply-script-generator-prompt.md",
  "offer-soon-analyze-prompt.md",
  "offer-soon-script-generator-prompt.md",
];
// The script prompts that carry Alex's "no em dashes, no double hyphens" rule.
// CLAUDE.md: the prompt files themselves must contain none, because the model
// mirrors their style (an em-dash prompt once produced 7 in a script).
const NO_DASH = ["apply-script-generator-prompt.md", "offer-soon-script-generator-prompt.md"];
const LINK_TO_SESSION = ["script-generator-prompt.md", ...NO_DASH];

describe("prompt files", () => {
  it.each(ALL)("%s loads and is substantial", (f) => {
    expect(loadPrompt(f).length).toBeGreaterThan(3000);
  });

  it.each(NO_DASH)("%s contains no em dashes or double hyphens", (f) => {
    const text = loadPrompt(f);
    expect(text).not.toContain("—");
    expect(text).not.toMatch(/(^|[^-])--([^-]|$)/m);
  });

  it.each(LINK_TO_SESSION)("%s links the paid session through the placeholder", (f) => {
    expect(loadPrompt(f)).toContain("{{strategy_session_url}}");
  });

  it("fails loudly on a missing prompt instead of using a generic one", () => {
    expect(() => loadPrompt("does-not-exist-prompt.md")).toThrow(/could not be read/);
  });

  it("never describes the session as free or a consult in the script prompts' own CTA wording", () => {
    for (const f of LINK_TO_SESSION) {
      expect(loadPrompt(f)).not.toMatch(/free consult(ation)? (with|call)/i);
    }
  });
});
