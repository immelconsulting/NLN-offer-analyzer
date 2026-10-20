import { useEffect, useState } from "react";
import icon from "../assets/nln-icon.png";

// Full-screen wait while an analysis runs (70-90 seconds). Instead of one
// static line, it cycles through what the analyzer is actually doing, built
// from what the person typed. The specialist sources mirror the routing in
// the analyze prompts: Levels.fyi and Built In for tech roles, RepVue and
// Betts for revenue roles, BLS and Glassdoor always. The last step holds
// until the result arrives, so it never runs out early or loops.

const STEP_MS = 7000;

const TECH = /\b(engineer\w*|developer|software|product|design\w*|data|analyst|analytics|devops|it|security|machine learning|ml|ai|cloud|architect|qa|ux|ui|scientist)\b/i;
const REVENUE = /\b(sales|account (executive|manager)|ae|sdr|bdr|business development|customer success|revenue)\b/i;

function specialistStep({ role, industry }) {
  const text = `${role || ""} ${industry || ""}`;
  if (industry === "Sales" || REVENUE.test(text)) return "Checking RepVue and Betts sales compensation reports…";
  if (industry === "Tech" || industry === "Data/Analytics" || TECH.test(text)) return "Checking Levels.fyi and Built In tech pay data…";
  return null;
}

// What the screen says, in order, for each flow.
export function loadingSteps(flow, { role, location, company, industry, years } = {}) {
  const where = location ? ` in ${location}` : "";
  const forRole = role ? ` for ${role}${where}` : where;
  const research = [
    "Pulling market rates from the Bureau of Labor Statistics…",
    `Checking Glassdoor salary reports${forRole}…`,
    specialistStep({ role, industry }),
  ];
  const strategies = [
    "Preparing a cautious negotiation strategy…",
    "Preparing a balanced negotiation strategy…",
    "Preparing an aggressive negotiation strategy…",
  ];

  let steps;
  if (flow === "offer") {
    steps = [
      ...research,
      "Comparing your offer against what we found…",
      "Scoring your offer and spotting where there's room to grow…",
      ...strategies,
      "Putting your recommendations together…",
    ];
  } else if (flow === "offer_soon") {
    steps = [
      ...research,
      company ? `Researching what ${company} pays for this role…` : null,
      "Building what a strong offer looks like…",
      "Reading your leverage going into the offer call…",
      ...strategies,
      "Putting your recommendations together…",
    ];
  } else {
    steps = [
      ...research,
      years ? `Adjusting for your ${years} years of experience…` : null,
      "Building your target salary range…",
      ...strategies,
      "Putting your recommendations together…",
    ];
  }
  return steps.filter(Boolean);
}

export default function AnalysisLoading({ title, steps }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), STEP_MS);
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center px-6 text-center">
      <img src={icon} alt="NLN" className="h-14 w-auto animate-pulse mb-8" />
      <div className="h-10 w-10 rounded-full border-4 border-navy-100 border-t-navy-600 animate-spin mb-6" />
      <p className="text-xl font-serif font-semibold text-navy-900">{title}</p>
      {/* Announced to screen readers as it changes. */}
      <p key={i} className="text-navy-600 font-medium mt-3 max-w-sm min-h-[3rem] animate-[fadeIn_0.5s_ease-out]" aria-live="polite">
        {steps[i]}
      </p>
      <div className="flex gap-1.5 mt-3" aria-hidden="true">
        {steps.map((_, n) => (
          <span key={n} className={`h-1.5 w-1.5 rounded-full ${n <= i ? "bg-navy-600" : "bg-navy-100"}`} />
        ))}
      </div>
      <p className="text-slate-500 text-sm mt-5 max-w-xs">
        Real research takes up to two minutes. It's worth the wait for real numbers.
      </p>
    </div>
  );
}
