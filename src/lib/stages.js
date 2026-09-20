// The two pre-offer stages. Applying and Interviewing face the same
// negotiation moment — a recruiter asking what you're looking for — so they
// share one form, one analyzer, one results page, one proof page, and one
// script prompt. Only the copy below differs.
//
// They are kept as separate `flow` values (not merged into one) so the admin
// can still tell which stage someone came from, and so the copy can diverge
// later without restructuring anything.

export const PRE_OFFER_STAGES = {
  apply: {
    id: "apply",
    label: "Applying",
    basePath: "/apply",
    formIntro:
      "Before a recruiter asks what you're looking for, know exactly what to say. Answer five quick questions and we'll research your market rate.",
    // Used in the analysis and script prompts so the coaching lands in the
    // right place in the process.
    situation:
      "actively applying to roles, so the recruiter screening call is the next compensation moment ahead of them",
  },
  interview: {
    id: "interview",
    label: "Interviewing",
    basePath: "/interview",
    formIntro:
      "You're already in the process, which means the salary question is coming. Answer five quick questions and we'll research your market rate before it does.",
    situation:
      "already interviewing, so the salary question is either imminent or has already come up at least once in the process",
  },
};

export const isPreOfferFlow = (flow) =>
  Object.prototype.hasOwnProperty.call(PRE_OFFER_STAGES, flow);

export const getStage = (flow) =>
  PRE_OFFER_STAGES[flow] || PRE_OFFER_STAGES.apply;
