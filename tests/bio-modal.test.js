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
  it("the footer uses it, with Get my number only on the landing page", () => {
    const footer = read("src/components/SiteFooter.jsx");
    expect(footer).toContain("<WhoIsBehindThis");
    expect(footer).toContain('onLanding ? "Get my number" : "Close"');
  });
});
