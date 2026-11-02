// Adds two things to a Stripe Payment Link before sending the buyer there:
//
// - client_reference_id: the analysis this purchase is for. Stripe keeps it
//   on the checkout session, so /api/generate-script can load the right
//   analysis from storage even on a different device or browser.
// - prefilled_email: the email they gave for their results, if any, so the
//   receipt and the emailed script go to the same place. They can still
//   change it at checkout.
//
// Stripe only accepts letters, digits, "-" and "_" (max 200) in the
// reference, so anything else is left off rather than breaking checkout.

const VALID_REFERENCE = /^[A-Za-z0-9_-]{1,200}$/;

function leadEmail() {
  try {
    return JSON.parse(sessionStorage.getItem("nln:lead"))?.email || "";
  } catch {
    return "";
  }
}

// The session page isn't tied to one result, so the latest analysis this
// browser saw is what a session purchase refers back to (Jenny's alert).
const ANALYSIS_KEY = "nln:lastAnalysis";

export function rememberAnalysis(submissionId) {
  try {
    if (submissionId) localStorage.setItem(ANALYSIS_KEY, submissionId);
  } catch {
    // The alert falls back to matching on the checkout email.
  }
}

export function rememberedAnalysis() {
  try {
    return localStorage.getItem(ANALYSIS_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function checkoutUrl(paymentLink, { submissionId } = {}) {
  try {
    const url = new URL(paymentLink);
    if (submissionId && VALID_REFERENCE.test(submissionId)) {
      url.searchParams.set("client_reference_id", submissionId);
    }
    const email = leadEmail();
    if (email) url.searchParams.set("prefilled_email", email);
    return url.toString();
  } catch {
    return paymentLink;
  }
}
