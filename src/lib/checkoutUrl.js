// Adds two things to a Stripe Payment Link before sending the buyer there:
//
// - client_reference_id: the analysis this purchase is for. Stripe keeps it
//   on the checkout session, so /api/generate-script can load the right
//   analysis from storage even on a different device or browser.
// - prefilled_email: the email they gave on the landing page, so the
//   receipt, the emailed script, and Jenny's session alert all line up with
//   their analyzer history. They can still change it at checkout.
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
