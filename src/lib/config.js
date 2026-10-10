// Central place for external URLs so they can be swapped without touching
// components. Replace the placeholders before going live.

// Stripe Payment Link for the DIY counter-offer script.
// In Stripe: set the after-payment redirect to
//   https://<your-domain>/script?session_id={CHECKOUT_SESSION_ID}
export const STRIPE_PAYMENT_LINK_URL = "https://buy.stripe.com/00w9AU2v923D39K5lybwk01";

// Booking link for the paid 1:1 Negotiation Strategy Session. As of the
// JobJenny pilot this is run by the JobJenny team (Jenny/Alisa), not Alex —
// every "talk to a human" CTA in the funnel routes here instead of a free
// call with Alex, since the pilot's commercial model depends on converting
// tool users into paid sessions rather than free 1:1s.
//
// Where a *generated script PDF* sends people to book. It has to be an
// absolute URL — the script is downloaded and read outside the app, so a
// relative "/session" link would be dead there. Pointing it at the sell page
// (rather than straight at a checkout link) lets the reader pick their tier.
export const STRATEGY_SESSION_URL = "https://nln-offer-analyzer.vercel.app/session";

// Stripe Payment Links for the two session tiers, one per price.
//
// Live links on NLN's Stripe account (acct_1MRh0gKjxEB5kBDn), created in the
// dashboard Oct 2026. /booking tells the tiers apart by the Price's amount
// ($199 / $329) since dashboard-made Prices have no lookup key, so keep those
// amounts in sync with PRICE_AMOUNT_KEYS in api/verify-payment.js. The
// after-payment redirect on BOTH is:
//   https://<your-domain>/booking?session_id={CHECKOUT_SESSION_ID}
export const STRATEGY_SESSION_30MIN_CHECKOUT_URL = "https://buy.stripe.com/cNi28sglZbEdaCc7tGbwk02";
export const STRATEGY_SESSION_60MIN_CHECKOUT_URL = "https://buy.stripe.com/5kQbJ2d9N37HeSsbJWbwk03";

// JobJenny's Thryv calendar, one direct link per tier, so someone who paid for
// 30 minutes can't land on the full service list and pick the hour by mistake.
// Only the server reads these: /api/verify-payment works out which tier the
// Stripe session bought and returns the matching link, so neither URL ships
// in the browser bundle.
export const THRIVE_30MIN_BOOKING_URL =
  "https://go.thryv.com/site/JobJenny/online-scheduling?service=uc1jg8nykyxc12fg";
export const THRIVE_60MIN_BOOKING_URL =
  "https://go.thryv.com/site/JobJenny/online-scheduling?service=zlah96bvp0955skx";

// How /api/verify-payment tells the tiers apart: each session Price carries
// one of these lookup keys (set by scripts/create-session-payment-links.js).
// Lookup keys survive a Payment Link being recreated, unlike link/price IDs.
export const SESSION_TIERS = {
  nln_strategy_session_30min: { label: "30 minutes", bookingUrl: THRIVE_30MIN_BOOKING_URL },
  nln_strategy_session_60min: { label: "60 minutes", bookingUrl: THRIVE_60MIN_BOOKING_URL },
};

// Display-only price labels used in CTA captions and the session proof page.
// Centralized so a price change is a one-line edit here instead of a copy
// hunt across pages. Keep these in sync with the Stripe Payment Links above.
export const STRATEGY_SESSION_PRICE_LABEL = "$199";
export const STRATEGY_SESSION_PRICE_LABEL_60MIN = "$329";

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
