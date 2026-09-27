// The four funnel paths, declared explicitly in one place.
//
// This replaces the older "pre-offer stages" grouping. That grouping quietly
// meant two different things at once: "has no offer yet" and "uses the
// screening-call form and prompts". Those came apart the moment
// expecting-an-offer-soon arrived, which has no offer either but faces the
// offer call and needs its own prompts, form, and results copy.
//
// So each flow now declares what it uses. Adding a flow means adding a row
// here and the matching prompt file, not editing a chain of booleans.

export const FLOWS = {
  offer: {
    id: "offer",
    label: "Offer",
    basePath: "/offer",
    resultsPath: "/results",
    proofPath: "/proof",
    // The offer form names its fields role/company; every other flow uses
    // targetRole/targetCompany.
    usesTargetFields: false,
  },
  apply: {
    id: "apply",
    label: "Applying",
    basePath: "/apply",
    resultsPath: "/apply/results",
    proofPath: "/apply/proof",
    usesTargetFields: true,
    formIntro:
      "Before a recruiter asks what you're looking for, know exactly what to say. Answer five quick questions and we'll research your market rate.",
    // Passed into the analysis and script prompts so coaching lands in the
    // right place in the process.
    situation:
      "actively applying to roles, so the recruiter screening call is the next compensation moment ahead of them",
  },
  interview: {
    id: "interview",
    label: "Interviewing",
    basePath: "/interview",
    resultsPath: "/interview/results",
    proofPath: "/interview/proof",
    usesTargetFields: true,
    formIntro:
      "You're already in the process, which means the salary question is coming. Answer five quick questions and we'll research your market rate before it does.",
    situation:
      "already interviewing, so the salary question is either imminent or has already come up at least once in the process",
  },
  offer_soon: {
    id: "offer_soon",
    label: "Offer soon",
    basePath: "/offer-soon",
    resultsPath: "/offer-soon/results",
    proofPath: "/offer-soon/proof",
    usesTargetFields: true,
    formIntro:
      "The offer call is coming. Answer a few quick questions and we'll research what a strong offer looks like for you before it does.",
  },
};

// Applying and Interviewing, and only those two. They face the identical
// moment (a recruiter asking what you want), so they share the screening-call
// form, analyzer, prompts, and results page. Expecting-an-offer-soon is NOT
// in this list: it faces the offer call and has its own of each.
export const SCREENING_FLOWS = ["apply", "interview"];

export const isScreeningFlow = (flow) => SCREENING_FLOWS.includes(flow);

export const isKnownFlow = (flow) =>
  Object.prototype.hasOwnProperty.call(FLOWS, flow);

// Unrecognized ids fall back to the offer flow, which is what old stashes and
// shared links from before the `flow` field decode as.
export const getFlow = (flow) => FLOWS[flow] || FLOWS.offer;

// True for every flow whose form uses targetRole/targetCompany.
export const usesTargetFields = (flow) => Boolean(FLOWS[flow]?.usesTargetFields);
