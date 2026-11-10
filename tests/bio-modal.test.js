import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CLIENT_EVENTS } from "../api/_lib/events.js";

vi.mock("../src/lib/track.js", () => ({ track: vi.fn() }));
const { default: WhoIsBehindThis } = await import("../src/components/BioModal.jsx");

const read = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

describe("no links to NLN's website (Alex, Nov 2026: it's out of date)", () => {
  const files = [
    ...fs.readdirSync(new URL("../src/components/", import.meta.url)).map((f) => `src/components/${f}`),
    ...fs.readdirSync(new URL("../src/lib/", import.meta.url)).map((f) => `src/lib/${f}`),
    ...fs.readdirSync(new URL("../api/_lib/", import.meta.url)).map((f) => `api/_lib/${f}`),
    ...fs.readdirSync(new URL("../", import.meta.url)).filter((f) => f.endsWith("-prompt.md")),
  ].filter((f) => /\.(jsx?|md)$/.test(f));
  it.each(files)("%s", (f) => {
    // Email addresses on the domain are fine; a link to the site isn't.
    const links = read(f).match(/(?:https?:\/\/|www\.)(?:www\.)?nextlevelnegotiation\.com/g) || [];
    expect(links).toEqual([]);
  });
});

describe("Who's behind this?", () => {
  it("is a button that opens nothing by itself", () => {
    const html = renderToStaticMarkup(createElement(WhoIsBehindThis));
    expect(html).toContain("Who’s behind this?");
    expect(html).not.toContain('role="dialog"');
  });
  it("carries the agreed copy and closes three ways", () => {
    const src = read("src/components/BioModal.jsx");
    expect(src).toContain("Hi, I'm Alex Immel");
    expect(src).toContain("built by Next Level Negotiation in partnership with JobJenny.com.");
    expect(src).toContain('e.key === "Escape"');
    expect(src).toContain("e.target === e.currentTarget");
    expect(src).toContain('aria-label="Close"');
    expect(src).toContain('target="_blank"');
  });
  it("is counted in the admin dashboard", () => {
    expect(CLIENT_EVENTS).toContain("bio_modal_opened");
    expect(read("src/components/AdminDashboard.jsx")).toContain("bio_modal_opened:");
  });
  it("its main button goes to Alex's LinkedIn in a new tab", () => {
    const src = read("src/components/BioModal.jsx");
    expect(src).toContain("href={ALEX_LINKEDIN_URL}");
    expect(src).not.toContain("Get my number");
    expect(read("src/lib/config.js")).toContain('ALEX_LINKEDIN_URL = "https://www.linkedin.com/in/aleximmel/"');
  });
  it.each(["src/components/SiteFooter.jsx", "src/components/LandingPage.jsx", "src/components/ProofContent.jsx"])("%s offers it", (f) => {
    expect(read(f)).toContain("<WhoIsBehindThis");
  });
  it("on the landing page it sits below the stage choice", () => {
    const landing = read("src/components/LandingPage.jsx");
    expect(landing.indexOf("<WhoIsBehindThis")).toBeGreaterThan(landing.indexOf("STAGES.map"));
  });
  it("on the $47 offer the note sits below the checkout button", () => {
    const proof = read("src/components/ProofContent.jsx");
    expect(proof.indexOf("Your script is built on the same approach")).toBeGreaterThan(proof.indexOf("onClick={onCheckout}"));
  });
});

describe("partnership and JobJenny.com", () => {
  it("credits the partnership once, in the footer under every page", () => {
    expect(read("src/components/SiteFooter.jsx")).toContain("Built by Next Level Negotiation in partnership with JobJenny.com.");
    expect(read("src/components/LandingPage.jsx")).not.toContain("Built by Next Level Negotiation");
  });
  it("introduces Jenny on the session page", () => {
    expect(read("src/components/SessionProofPage.jsx")).toContain("Jenny Foss, career coach and founder of JobJenny.com.");
  });
  it("names the company JobJenny.com wherever customers read it", () => {
    for (const f of ["src/components/ProofContent.jsx", "src/components/PrivacyPolicy.jsx", "src/components/SessionProofPage.jsx"]) {
      const copy = read(f).replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(copy).not.toMatch(/JobJenny(?!\.com|\/)/);
    }
  });
});

describe("Alex's years of experience match everywhere", () => {
  it("says 6+ years, like his bio", () => {
    expect(read("src/components/ProofContent.jsx")).not.toMatch(/\b5\+ years/);
    expect(read("src/components/BioModal.jsx")).toContain("For 6+ years");
  });
});
