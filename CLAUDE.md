# NLN Offer Analyzer — Project Guide

AI-powered salary negotiation funnel for Next Level Negotiation (NLN), founded by Alex Immel
(alex@nextlevelnegotiation.com). React 18 + Vite + Tailwind, deployed on Vercel at
https://nln-offer-analyzer.vercel.app (repo: immelconsulting/NLN-offer-analyzer, deploys from `main`).
Alex is non-technical: explain changes in plain English and give click-by-click steps for
dashboards (Stripe, Vercel, Trustpilot).

## Funnel (all verified end-to-end, including a real Stripe payment)

1. `/` **LandingPage** — hero + required email + job-search stage question + an unchecked
   marketing opt-in checkbox (compliance: email is required only to deliver results; marketing
   needs the explicit opt-in). Every lead (email/stage/marketingOptIn/timestamp) is POSTed to
   `/api/lead` (Upstash Redis list `nln:leads`). CSV export: `GET /api/leads?token=<LEADS_EXPORT_TOKEN>`
   (pre-checkbox leads export as opt-in "no"). Privacy Policy lives at `/privacy`
   (`src/components/PrivacyPolicy.jsx`), linked near the email field.
2. Branch: only **"Received an offer"** → `/offer`. Applying / Interviewing / Expecting-soon →
   `/thanks`, a stage-matched resource page (PDF guides in `public/resources/`) + Calendly CTA.
3. `/offer` **OfferForm** — analyzer form. Required: role, location, base salary, top priority,
   **risk tolerance** (Cautious/Balanced/Aggressive). Optional: "Anything else we should know?"
   context textarea, plus an "Extra Context" section — resume upload and job-description
   paste-or-upload (PDF/DOCX/TXT, 2MB client cap; no URL fetching by design — job boards block
   it and server-side URL fetch is an SSRF risk). Files are base64-POSTed to `/api/analyze`
   only; they never enter the URL-encoded results. `api/_lib/extract.js` extracts text
   (**unpdf** for PDFs — pdf-parse crashes at boot on Vercel; mammoth for DOCX; lazy imports so
   the endpoint can never die from a parser), which feeds both prompts and is stored on the
   submission record (text only, never files). `/api/generate-script` reloads it via
   `analysis.submissionId`. Salary inputs auto-format with thousands commas.
4. `/api/analyze` — Claude with tool-use returns structured JSON: score, opportunities, three
   strategies, plus a `sources` array. System prompt lives in `system-prompt.md`.
   **The model web-searches for live comp data before answering**, so `tool_choice` must stay
   `auto` — forcing `submit_offer_analysis` makes it answer immediately and skip every search
   (that was the pre-Aug-2026 behavior). The handler loops to resume `pause_turn` (server-side
   search cap) and nudges once with the tool forced if the model replies without calling it.
   Source routing lives in the prompt: BLS + Glassdoor always, Levels.fyi + BuiltIn for tech,
   Repvue + Betts for revenue roles; skip a source rather than guess, and never state a salary
   figure that didn't come from a search result this session. `sources: []` is valid and means
   "no usable data found" — the analysis then says so instead of inventing numbers.
   **Latency: ~70–90s** (was ~25s), hence `maxDuration: 300` in `vercel.json` and the
   two-minute expectation in the loading overlay. Web search bills ~$10/1,000 searches on top
   of tokens, and the free analysis is what runs it — watch the per-analysis cost.
   **Don't lower `max_uses` below 3 to chase speed — measured, it doesn't work.** Generation
   alone is a fixed ~27s; each search adds ~15–20s. Going 5→2 saved only ~20s but made the
   model drop the specialist sources entirely (a tech offer came back citing Glassdoor alone,
   no Levels.fyi; sales lost Repvue and Betts). 3 is the floor that still routes correctly, and
   it runs within ~5s of 2. Real speed levers are output size or model choice, not search count.
5. `/results` **ResultsPage** — score, opportunities, three strategy cards. The risk-tolerance
   answer maps Cautious→Conservative / Balanced→Balanced / Aggressive→Aggressive and puts the
   "Recommended for you" badge on that card (old links without the field fall back to Balanced).
   Results are stateless: everything is base64-encoded in the `?d=` URL param (`src/lib/encodeResult.js`).
6. Micro-decision → `/proof` **ProofPage** — credibility page ($47 early-access price, Trustpilot
   proof, quote) with two CTAs: Stripe checkout or Calendly. Before checkout the encoded offer data
   is stashed in `localStorage["nln:pendingScript"]`.
7. Stripe Payment Link redirects to `/script?session_id={CHECKOUT_SESSION_ID}`. **ScriptPage** reads
   the stash and POSTs to `/api/generate-script`, which verifies the checkout session is paid
   (`paid` or `no_payment_required`) via `STRIPE_SECRET_KEY`, then generates the counter-offer
   script from `script-generator-prompt.md`. Output is markdown (comp table via remark-gfm),
   rendered with react-markdown; page offers Download-as-PDF (window.print) and a feedback mailto.

## Submission storage & admin (added July 26, 2026)

Every successful analysis persists to Upstash: `nln:sub:<id>` records (form + analysis +
script when generated), indexed by `nln:subs` (newest first) and `nln:subs:email:<email>`.
Append-only history; email comes from the landing-page session (`leadEmail` in the analyze
payload). `analysis.submissionId` rides inside the encoded `?d=` data so `/api/generate-script`
can attach the script to the same record. Storage failures never block users.

`/admin` (route, not linked anywhere) + `GET /api/admin?token=<LEADS_EXPORT_TOKEN>` — search by
email/role/company/location, detail view, CSV exports (`&export=full` or `&export=salary`).

The analyzer feeds anonymized aggregates of similar past submissions into the prompt
(`api/_lib/comparables.js`: synonym+token title matching, city match, IQR outlier filtering;
median-only at 3-4 samples, range at 5+; requester's own email excluded). The server sets
`analysis.internalDataUsed`; results page shows a subtle caption when true. Never pass
identifying details into another user's analysis — aggregates only.

- `system-prompt.md` / `script-generator-prompt.md` — both prompts are file-based, read at request time.
- `src/lib/config.js` — Stripe Payment Link URL, Calendly URL, Trustpilot URL, contact email,
  and the `FREE_TEST_MODE` flag.
- `api/analyze.js`, `api/generate-script.js`, `api/lead.js`, `api/leads.js` — Vercel functions.
- Brand: navy scale in `tailwind.config.js` (#001E34 / #16163F / #0099CC / #6BCCF7 / #D8F0F8),
  logos in `src/assets/`, Trustpilot green #00B67A for stars.

## Environment variables (Vercel)

`ANTHROPIC_API_KEY`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash marketplace integration;
code also accepts `UPSTASH_*` names), `STRIPE_SECRET_KEY`, `LEADS_EXPORT_TOKEN`,
`ALLOW_TEST_BYPASS` (temporary, see below).

## Testing without paying

`session_id=test_skip_payment` skips Stripe verification — always on non-production deployments,
and in production only while `ALLOW_TEST_BYPASS=true`. A visible "[Testing] Generate my script
free" button on `/proof` (gated by `FREE_TEST_MODE` in config.js) uses it.
**This free-test path is temporary — remove both flags when testing ends.**
Stripe promo-code testing: 100%-off codes are rejected on one-time Payment Links, and discounts
leaving less than $0.50 also fail — use 99% off (or price − $0.50 max discount).

## Stripe account gotchas

Alex has multiple Stripe accounts, two formerly both named "Immel Consulting LLC". The correct
account (payment link, coupons, secret key must ALL live here) is `acct_1MRh0gKjxEB5kBDn`,
renamed "Next Level Negotiation". Stripe object IDs embed the account fingerprint (the chars
after the 6-char unique part match the account ID tail) — useful to detect wrong-account objects.
Payment Link after-payment redirect must be `https://<domain>/script?session_id={CHECKOUT_SESSION_ID}`.

## Script content rules (Alex's voice — do not regress)

Concise spoken lines (1–2 sentences; long scripts sound rehearsed). Collaborative, never
defensive — Accusations Audit names the awkward thing then stops, no self-justification.
Intro: Alex introduced as founder & CEO, anchor as a markdown comp table with annualized equity
(assume 4-year vesting if unstated), trust-your-gut/don't-act-from-fear note. NLN calibrated
questions (hiring-team feedback early; "How did you come to this offer?" pre-counter; "best you
can do without putting yourself in a bad position" for objections). Clear open questions before
negotiating. No day-specific timing advice unless the deadline confirms a safe window.
Industry lens (tech=base/equity; healthcare/gov/nonprofit=non-salary levers; finance/legal=
bonus/sign-on) never overrides actual offer data. Free-consult mentions link Calendly
(calendly.com/aleximmel/salary-negotiation-consultation). No fake urgency, no crossed-out prices.

**Compliance copy (required — never remove):** AI-disclosure lines below the CTAs on the landing
page, offer form, and results page ("uses AI, guided by NLN's negotiation methodology" — never
claim the AI is "trained on" NLN material), and an AI-disclosure + not-professional-advice
disclaimer on the script page (which intentionally prints in the PDF). These support Anthropic
AUP requirements for consumer-facing employment-related advice (disclosure at session start).

## Local development quirks

- `npm run dev` serves only the frontend — `/api` functions 404 locally (no Vercel CLI installed).
  Test API handlers by importing them in Node with mock req/res objects and `test_skip_payment`.
- `npm run build` / `git add` occasionally hang or bus-error (stale `.git/index.lock` once needed
  removal). Vite can take 60–90s to bind. Local builds are optional; Vercel builds on deploy.
- Commits are pushed straight to `main` for small changes; use a branch + Vercel preview URL when
  Alex wants to test on his phone first.
