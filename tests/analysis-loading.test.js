import { describe, it, expect } from "vitest";
import { loadingSteps } from "../src/components/AnalysisLoading.jsx";

describe("loading screen messages", () => {
  it("names the sources the analysis actually uses, per role type", () => {
    const tech = loadingSteps("offer", { role: "Senior Software Engineer", location: "Denver, CO", industry: "Tech" });
    expect(tech[0]).toMatch(/Bureau of Labor Statistics/);
    expect(tech[1]).toBe("Checking Glassdoor salary reports for Senior Software Engineer in Denver, CO…");
    expect(tech).toContain("Checking Levels.fyi and Built In tech pay data…");

    const sales = loadingSteps("apply", { role: "Account Executive" });
    expect(sales).toContain("Checking RepVue and Betts sales compensation reports…");

    const other = loadingSteps("apply", { role: "Nurse", location: "Boise" });
    expect(other.join(" ")).not.toMatch(/Levels\.fyi|RepVue/);
  });

  it("walks through all three strategies and ends on the wrap-up", () => {
    for (const flow of ["offer", "apply", "interview", "offer_soon"]) {
      const steps = loadingSteps(flow, { role: "PM" });
      expect(steps).toEqual(expect.arrayContaining([
        "Preparing a cautious negotiation strategy…",
        "Preparing a balanced negotiation strategy…",
        "Preparing an aggressive negotiation strategy…",
      ]));
      expect(steps.at(-1)).toBe("Putting your recommendations together…");
    }
  });

  it("is specific to each flow", () => {
    expect(loadingSteps("offer_soon", { role: "AE", company: "Globex" })).toContain("Researching what Globex pays for this role…");
    expect(loadingSteps("interview", { years: "6-9" })).toContain("Adjusting for your 6-9 years of experience…");
    expect(loadingSteps("offer", {})).toContain("Comparing your offer against what we found…");
  });
});
