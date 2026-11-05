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

  it("offer analysis recommends emailing the recruiter, never a call to schedule a call", () => {
    const text = loadPrompt("system-prompt.md");
    expect(text).toMatch(/an email to the recruiter/i);
    expect(text).toMatch(/Never recommend calling the recruiter just to schedule/);
    expect(text).not.toMatch(/Do you have 10 minutes/);
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

describe("the told-the-number section of the screening script", () => {
  const prompt = loadPrompt("apply-script-generator-prompt.md");
  const section = prompt.slice(
    prompt.indexOf("**When the recruiter already told you the number.**"),
    prompt.indexOf("**When the question has not come up.**")
  );

  it("spells the lines out instead of pointing at labels the customer never sees", () => {
    expect(section.length).toBeGreaterThan(200);
    expect(section).not.toMatch(/branch \(/);
    expect(section).toMatch(/Never mention branches/);
  });
});

describe("Marian's feedback on the scripts", () => {
  const screening = loadPrompt("apply-script-generator-prompt.md");
  const offerSoon = loadPrompt("offer-soon-script-generator-prompt.md");

  it("drops the absolute 'whoever speaks first loses' wording", () => {
    for (const prompt of [screening, offerSoon, loadPrompt("apply-analyze-prompt.md")]) {
      expect(prompt).not.toMatch(/gives up the advantage|leverage from whoever speaks first|advantage stays with you/i);
    }
  });
  it("offers a line for asking the range when the posting has none, after the question", () => {
    const line = screening.indexOf("could you share the salary range for this role?");
    expect(line).toBeGreaterThan(screening.indexOf('**Q: "What are your salary expectations?"**'));
  });
  it("points to the fallback straight after the first deflection", () => {
    expect(screening).toContain('If they push for a number, see "When they insist on a number" below.');
    expect(screening).toContain("**When they insist on a number**");
  });
  it.each([["screening", screening], ["offer call", offerSoon]])("%s: the floor is a reference point, and going below it is covered", (_, prompt) => {
    expect(prompt).not.toMatch(/walk-away|not worth continuing/i);
    expect(prompt).toContain("Where you set your own floor is up to you.");
    expect(prompt).toContain("If a lower number works for you");
    expect(prompt).toContain("compensation review at six months");
  });
  it("the offer call still never accepts on the call", () => {
    expect(offerSoon).toContain("they still do not accept on the spot");
  });
  it("says the later scripts cover money that already came up", () => {
    expect(screening).toContain("If money already came up");
    expect(screening).toContain("the Offer Call and Counter-Offer scripts cover how to reopen");
  });
  it.each([["screening", screening], ["offer call", offerSoon]])("%s: links to the offer flow rather than asking to paste a URL", (_, prompt) => {
    expect(prompt).toContain("[Analyze your offer](https://www.jobofferanalyzer.com/offer)");
  });
});
