// Central place for external URLs so they can be swapped without touching
// components. Replace the placeholders before going live.

// Stripe Payment Link for the DIY counter-offer script.
// In Stripe: set the after-payment redirect to
//   https://<your-domain>/script?session_id={CHECKOUT_SESSION_ID}
export const STRIPE_PAYMENT_LINK_URL = "https://buy.stripe.com/00w9AU2v923D39K5lybwk01";

// Scheduling link (Calendly or similar) for the expert path.
export const SCHEDULING_URL = "https://calendly.com/aleximmel/salary-negotiation-consultation";

// Public Trustpilot profile, linked from the proof page.
export const TRUSTPILOT_REVIEWS_URL = "https://www.trustpilot.com/review/nextlevelnegotiation.com";

export const CONTACT_EMAIL = "alex@nextlevelnegotiation.com";

// TEMPORARY: shows a free "skip payment" button on the proof page for
// testing the script generator. To remove the free path later:
//   1. Set this to false (hides the button)
//   2. Delete the ALLOW_TEST_BYPASS env var in Vercel (disables the server
//      bypass) and redeploy
// The paid flow is unaffected either way — both paths share the same code.
export const FREE_TEST_MODE = true;
