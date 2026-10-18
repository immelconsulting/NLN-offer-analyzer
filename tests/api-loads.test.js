import { describe, it, expect } from "vitest";
import fs from "fs";

// Vercel's build doesn't compile /api, so a bad import there would only show
// up when a customer hits that endpoint. This loads every function.
const files = fs.readdirSync(new URL("../api", import.meta.url)).filter((f) => f.endsWith(".js"));

describe("every /api function loads", () => {
  it("finds the functions (Hobby plan caps at 12)", () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.length).toBeLessThanOrEqual(12);
  });
  it.each(files)("api/%s", async (f) => {
    const mod = await import(`../api/${f.replace(/\.js$/, "")}.js`);
    expect(typeof mod.default).toBe("function");
  });
});
