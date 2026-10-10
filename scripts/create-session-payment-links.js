// One-off: creates the two Negotiation Strategy Session Payment Links on
// NLN's Stripe account. Run it locally, once, with your own key:
//
//   STRIPE_SECRET_KEY=sk_live_... node scripts/create-session-payment-links.js
//
// Optional: BOOKING_DOMAIN=yourdomain.com (defaults to the Vercel domain).
// The key is read from the shell only; never put it in a file in this repo.
//
// Each Price gets a lookup key (nln_strategy_session_30min / _60min) that
// /api/verify-payment uses to send the buyer to the right Thryv calendar, so
// don't remove them in the Stripe dashboard.

import Stripe from "stripe";
import readline from "node:readline/promises";

const EXPECTED_ACCOUNT = "acct_1MRh0gKjxEB5kBDn";
const DOMAIN = process.env.BOOKING_DOMAIN || "nln-offer-analyzer.vercel.app";
const REDIRECT_URL = `https://${DOMAIN}/booking?session_id={CHECKOUT_SESSION_ID}`;

const TIERS = [
  {
    configName: "STRATEGY_SESSION_30MIN_CHECKOUT_URL",
    productName: "Negotiation Strategy Session, 30 Minutes",
    amount: 19900,
    lookupKey: "nln_strategy_session_30min",
  },
  {
    configName: "STRATEGY_SESSION_60MIN_CHECKOUT_URL",
    productName: "Negotiation Strategy Session, 60 Minutes",
    amount: 32900,
    lookupKey: "nln_strategy_session_60min",
  },
];

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
if (!key) fail("STRIPE_SECRET_KEY isn't set in this shell.");

const stripe = new Stripe(key);

// 1. Make sure this is the right Stripe account before touching anything.
const account = await stripe.accounts.retrieve();
if (account.id !== EXPECTED_ACCOUNT) {
  fail(
    `This key belongs to ${account.id} (${account.settings?.dashboard?.display_name || "unnamed"}), ` +
      `not ${EXPECTED_ACCOUNT} (Next Level Negotiation). Nothing was created.`
  );
}
const mode = key.startsWith("sk_live_") ? "LIVE (real charges)" : "TEST";

// 2. Don't create duplicates if this has already been run.
const existing = await stripe.prices.list({ lookup_keys: TIERS.map((t) => t.lookupKey) });
if (existing.data.length) {
  fail(
    "These session prices already exist on this account: " +
      existing.data.map((p) => `${p.lookup_key} (${p.id})`).join(", ") +
      ". Find their Payment Links in the Stripe dashboard instead of re-running this."
  );
}

// 3. Confirm before creating.
console.log(`\nAccount:  ${account.id} (${account.settings?.dashboard?.display_name || ""})`);
console.log(`Mode:     ${mode}`);
console.log(`Redirect: ${REDIRECT_URL}`);
console.log(`Creating: ${TIERS.map((t) => `${t.productName} at $${t.amount / 100}`).join("; ")}\n`);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question('Type "yes" to create them: ');
rl.close();
if (answer.trim().toLowerCase() !== "yes") fail("Cancelled. Nothing was created.");

// 4. Product → Price → Payment Link, per tier.
const results = [];
for (const tier of TIERS) {
  const product = await stripe.products.create({ name: tier.productName });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: tier.amount,
    currency: "usd",
    lookup_key: tier.lookupKey,
  });
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    after_completion: { type: "redirect", redirect: { url: REDIRECT_URL } },
    // Matches the $47 script link, so the 99%-off test coupons work here too.
    allow_promotion_codes: true,
    metadata: { tier: tier.lookupKey },
  });
  results.push({ ...tier, url: link.url, linkId: link.id });
}

console.log(`\n✔ Created on ${account.id} in ${mode} mode:\n`);
for (const r of results) {
  console.log(`  ${r.productName}`);
  console.log(`    ${r.configName} = "${r.url}"`);
  console.log(`    (Payment Link id ${r.linkId})\n`);
}
console.log("Paste the two URLs back to Claude Code to drop into src/lib/config.js.\n");
