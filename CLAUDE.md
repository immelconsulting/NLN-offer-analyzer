# NLN Offer Analyzer — Project Guide

AI-powered salary negotiation funnel for Next Level Negotiation (NLN), founded by Alex Immel
(alex@nextlevelnegotiation.com). React 18 + Vite + Tailwind, deployed on Vercel at
https://nln-offer-analyzer.vercel.app (repo: immelconsulting/NLN-offer-analyzer, deploys from `main`).
Alex is non-technical: explain changes in plain English and give click-by-click steps for
dashboards (Stripe, Vercel, Trustpilot).

## Current status (Sept 11, 2026)

Two products ship from this funnel:

1. **$47 self-serve counter-offer script** — fully live and working end-to-end, including real
   Stripe payments. Nothing outstanding.
2. **Paid Negotiation Strategy Session** ($199 / 30 min, $329 / hour) — pages are built and
   deployed, but **three URLs are still `REPLACE_ME` placeholders in `src/lib/config.js`**, so
   checkout and booking are non-functional until they're filled in:
   - `STRATEGY_SESSION_30MIN_CHECKOUT_URL` — Stripe Payment Link, $199 tier
   - `STRATEGY_SESSION_60MIN_CHECKOUT_URL` — Stripe Payment Link, $329 tier
   - `THRIVE_BOOKING_URL` — JobJenny's Thrive calendar, revealed after payment on `/booking`

   The two Stripe links must be created on `acct_1MRh0gKjxEB5kBDn` with their after-payment
   redirect set to `https://<domain>/booking?session_id={CHECKOUT_SESSION_ID}`. Until then the
   tier buttons lead to dead Stripe URLs — safe only because the site currently gets no traffic.

**JobJenny pilot:** strategy sessions are delivered by the JobJenny team (Jenny/Alisa), not
Alex. Most `/session` visitors are JobJenny coaching clients sent there straight after their
resume/LinkedIn work — see item 8 below, that audience drives the page's copy rules. There is
no longer a free-consult path anywhere in the funnel; every "talk to a human" CTA leads to a
paid tier.

## Funnel (script path verified end-to-end, including a real Stripe payment)

1. `/` **LandingPage** — hero + required email + job-search stage question + an unchecked
   marketing opt-in checkbox (compliance: email is required only to deliver results; marketing
   needs the explicit opt-in). Every lead (email/stage/marketingOptIn/timestamp) is POSTed to
   `/api/lead` (Upstash Redis list `nln:leads`). CSV export: `GET /api/leads?token=<LEADS_EXPORT_TOKEN>`
   (pre-checkbox leads export as opt-in "no"). Privacy Policy lives at `/privacy`
   (`src/components/PrivacyPolicy.jsx`), linked near the email field.
2. Branch (`STAGE_ROUTES` in LandingPage): **"Received an offer"** → `/offer`, **"Applying"** →
   `/apply` (see the Applying flow below). Interviewing / Expecting-soon → `/thanks`, a
   stage-matched resource page (PDF guides in `public/resources/`) + Strategy Session CTA.
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
   proof, quote) with two CTAs: Stripe checkout or a Strategy Session booking (routes to
   `/session`, never straight to the external booking link). Before checkout the encoded offer
   data is stashed in `localStorage["nln:pendingScript"]`.
7. Stripe Payment Link redirects to `/script?session_id={CHECKOUT_SESSION_ID}`. **ScriptPage** reads
   the stash and POSTs to `/api/generate-script`, which verifies the checkout session is paid
   (`paid` or `no_payment_required`) via `STRIPE_SECRET_KEY`, then generates the counter-offer
   script from `script-generator-prompt.md`. Output is markdown (comp table via remark-gfm),
   rendered with react-markdown; page offers Download-as-PDF (window.print) and a feedback mailto.
   The script's own sign-off links directly to `STRATEGY_SESSION_URL` (not `/session`), since it
   must still work when the script is downloaded/printed as a standalone PDF outside the app.
   The prompt holds a `{{strategy_session_url}}` placeholder that `api/generate-script.js`
   substitutes at request time, so the booking URL lives only in `src/lib/config.js`.
8. `/session` **SessionProofPage** (added Sept 2026, structurally mirrors ProofPage) — sells the
   paid Negotiation Strategy Session as two tiers, each linking its own Stripe Payment Link:
   $199 / 30 min (`STRATEGY_SESSION_30MIN_CHECKOUT_URL`) and $329 / hour
   (`STRATEGY_SESSION_60MIN_CHECKOUT_URL`, visually featured as "Most support"). Every in-app
   "book a session" CTA (ResultsPage, ProofPage's secondary CTA, ScriptPage's post-script
   upsell, ThankYou's dead-end pages) routes here rather than linking a booking URL directly.
   **Audience — this drives the copy:** mostly JobJenny coaching clients sent here right after
   their resume/LinkedIn work, not cold traffic, and often people who never touched the
   self-serve script. So the copy leans on the JobJenny relationship and must **never** frame a
   session as the better choice over the script — for most visitors the script isn't what
   they're weighing it against. Don't sync this page's copy to ProofPage's. No Trustpilot block
   here (JobJenny has no Trustpilot presence); the testimonial slot is an empty comment
   placeholder — a real quote from Jenny/Alisa's practice can fill it, but never reuse
   ProofPage's script testimonial, which is about the script product.
9. `/booking` **BookingPage** — post-payment destination for both session tiers. Stripe redirects
   here with `?session_id={CHECKOUT_SESSION_ID}`; the page POSTs to `/api/verify-payment`, and
   only on a confirmed-paid session does it reveal `THRIVE_BOOKING_URL` (JobJenny's calendar).
   Gating it server-side is deliberate — Stripe *could* redirect straight to the calendar, but
   then anyone who saw the URL could book a paid session for free.

## Applying flow (added Sept 20, 2026)

The first of the three dead-end stages to become a real flow. Same shape as the offer path
(short form → free researched analysis → $47 script → Strategy Session CTA), but there is no
offer yet, so the product is a **researched target range** and a **Recruiter Screening Call
Script** instead of a score and a counter-offer script.

- `/apply` **ApplyForm** — deliberately short. Required: target role, location, years of
  experience (0-2 / 3-5 / 6-9 / 10-15 / 15+), risk tolerance (same component and copy as the
  offer form), and "Where are you with the salary question?" (no call yet / call scheduled /
  asked and dodged / already gave a number), which carries a short blurb explaining what that
  question refers to. Picking "already gave a number" reveals an optional "What number did you
  share?" field. Optional: target company, **current total annual compensation**
  (`currentTotalComp` — base + bonus + commission + annualized equity, NOT base alone), free-text
  context, and a resume + **"Example Job Description"** upload section (a posting for the kind of
  role they're targeting, not necessarily one they applied to).
- `/api/analyze-apply` + `apply-analyze-prompt.md` — same search architecture as `/api/analyze`
  (see below), returning `submit_apply_analysis`: `market_range` (base + optional total_comp,
  each low/target/stretch), `confidence`, `range_rationale`, `biggest_risk`, `call_status_note`,
  three strategies (cautious/balanced/aggressive), `recommended_strategy`, and `sources`.
  **No score.** `market_range` is null when `sources` is empty, and the page says so rather than
  inventing numbers. `recommended_strategy` is set server-side from risk tolerance, not trusted
  from the model.
- **Current total comp is context only.** It is passed to the analyzer purely to sanity-check
  the range, is never echoed into the analysis or the script, and never drags the range below
  what the market supports. The script generator computes **two walk-away floors** (`applyFloors`
  in `generate-script.js`): a base floor (= base range low) and a total-comp floor
  (= max(total_comp low, current total comp)). **Total comp may only be compared against the
  total_comp range** — comparing it to base would inflate the base floor, since total comp sits
  well above base. A total floor that lands below the base floor is dropped as incoherent.
  The figure appears in the script only as a floor, never labelled as their current pay.
- **Apply submissions never feed `comparables.js`** — they are aspirational targets, not real
  offers. They're excluded there and from the admin salary CSV for the same reason.
- `/apply/results` **ApplyResultsPage** — range is the hero; also shows sources, biggest risk,
  and the call-status note. Stateless via the same base64 `?d=` param, with `flow: "apply"`
  inside the payload. **The three strategies are deliberately NOT rendered here** — they are
  effectively the script, and giving them away free removes the reason to buy it. They stay in
  the payload because the script generator builds from them.
- `/apply/proof` — ProofPage with `flow="apply"` (copy differs, structure shared, offer flow
  untouched). Reuses the **same $47 Stripe Payment Link and the same `/script?session_id=`
  redirect**, so nothing new exists in Stripe. No testimonial yet: the counter-offer quote is
  about a different product and must not be reused here.
- `/script` branches on the stashed `flow`, using `apply-script-generator-prompt.md`. The script
  is built around Alex's existing screening-call language (Option A / Option B, the
  "current salary" refusal, the wide-range answer) kept close to verbatim, with branches on the
  user's real numbers and a recovery section only when they already gave a number. Voice rules
  there add **no em dashes and no double dashes**. Sign-off links back to `/offer` for when the
  offer arrives, plus the usual `{{strategy_session_url}}`.
- **Scope: the salary question only.** No elevator pitch, "tell me about yourself" answer,
  background summary, or rapport scripting — those belong to a different conversation. The
  earlier part of the call gets a short prose orientation ("How the call usually opens") whose
  whole job is telling them not to raise compensation first; it carries no 🗣️ lines. **The
  scripted dialogue begins at "What are your salary expectations?" and nowhere earlier**, so no
  scripted line ever brings up money before the recruiter does.

Shared search loop lives in `api/_lib/analysis.js` (`runSearchAnalysis` + `SOURCES_SCHEMA`),
used by both analyzers — the `tool_choice: auto` / `pause_turn` / single-nudge behavior and
`max_uses: 3` are defined once there.

**Form drafts** (`src/lib/formDraft.js`): both forms save every text field to sessionStorage as
you type and prefill from it, so switching between Applying and Received-an-offer doesn't mean
retyping. Role/company mirror across the two names (`role` ↔ `targetRole`) so the most recent
edit wins in both directions. `currentSalary` (offer: base) and `currentTotalComp` (apply:
total) are deliberately **not** shared — different questions, and crossing them would corrupt
the floor math. Uploaded files are excluded: a 2MB upload is ~2.7MB of base64 and two would
exceed the ~5MB quota, so files must be re-picked.

**Note on prompt style:** `apply-script-generator-prompt.md` forbids em dashes in its output,
and the prompt file itself contains none. That's load-bearing — when the instructions used em
dashes in their own prose, the model mirrored the style and produced 7 of them in a script.

## Submission storage & admin (added July 26, 2026)

Every successful analysis persists to Upstash: `nln:sub:<id>` records (form + analysis +
script when generated), indexed by `nln:subs` (newest first) and `nln:subs:email:<email>`.
Append-only history; email comes from the landing-page session (`leadEmail` in the analyze
payload). `analysis.submissionId` rides inside the encoded `?d=` data so `/api/generate-script`
can attach the script to the same record. Storage failures never block users.

Apply submissions store the same way with `flow: "apply"`; offer records predate the field, so
anything unmarked is an offer.

`/admin` (route, not linked anywhere) — password login (`ADMIN_PASSWORD`, falling back to
`LEADS_EXPORT_TOKEN`) exchanged for an httpOnly session cookie by `/api/login`; `/api/admin`
requires that cookie and no longer accepts a `?token=` parameter, so no URL grants access.
Date-range filter (today / 7d / 30d / 3m / 4m / 6m / 1yr / custom) drives the funnel rollup, the
submissions table, and both CSV exports together. Sortable spreadsheet table with a Flow column
and an All / Offer / Apply filter; visual funnel with per-step percentages. **The salary CSV is
offer-rows only** — apply rows carry target ranges, not real offers.

The analyzer feeds anonymized aggregates of similar past submissions into the prompt
(`api/_lib/comparables.js`: synonym+token title matching, city match, IQR outlier filtering;
median-only at 3-4 samples, range at 5+; requester's own email excluded). The server sets
`analysis.internalDataUsed`; results page shows a subtle caption when true. Never pass
identifying details into another user's analysis — aggregates only.

- `system-prompt.md` / `script-generator-prompt.md` / `apply-analyze-prompt.md` /
  `apply-script-generator-prompt.md` — all four prompts are file-based, read at request time.
- `src/lib/config.js` — every external URL and price label in one place: the $47 script Stripe
  link, the two session-tier Stripe links, `THRIVE_BOOKING_URL`, `STRATEGY_SESSION_URL` (the
  absolute `/session` URL used by generated script PDFs — absolute because a relative link is
  dead once the PDF leaves the site), price labels, Trustpilot URL, contact email, and the
  `FREE_TEST_MODE` flag.
- `api/analyze.js`, `api/analyze-apply.js`, `api/generate-script.js`, `api/verify-payment.js`,
  `api/lead.js`, `api/leads.js`, `api/admin.js`, `api/login.js`, `api/event.js` — **9 Vercel
  functions; the Hobby plan caps at 12**, so there's room for about three more before the plan
  matters. Shared helpers live in `api/_lib/` (underscore = not deployed as functions):
  `store.js` (Upstash), `comparables.js`, `extract.js`, `analysis.js` (the shared web-search
  loop), `auth.js` (admin sessions), and `payment.js` (one Stripe checkout verifier, used by
  both the script and the session booking gate).
- Brand: navy scale in `tailwind.config.js` (#001E34 / #16163F / #0099CC / #6BCCF7 / #D8F0F8),
  logos in `src/assets/`, Trustpilot green #00B67A for stars.

## Environment variables (Vercel)

`ANTHROPIC_API_KEY`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash marketplace integration;
code also accepts `UPSTASH_*` names), `STRIPE_SECRET_KEY`, `LEADS_EXPORT_TOKEN`,
`ALLOW_TEST_BYPASS` (temporary, see below).

## Testing without paying

`session_id=test_skip_payment` skips Stripe verification — always on non-production deployments,
and in production only while `ALLOW_TEST_BYPASS=true`. Two visible testing links use it, both
gated by `FREE_TEST_MODE` in config.js: "[Testing] Generate my script free" on `/proof`, and
"[Testing] Skip payment and preview the booking step" on `/session` (jumps to `/booking`).
**This free-test path is temporary — remove both flags when testing ends** (set
`FREE_TEST_MODE = false` to hide the links, delete `ALLOW_TEST_BYPASS` in Vercel to close the
server-side bypass, then redeploy).
Stripe promo-code testing: 100%-off codes are rejected on one-time Payment Links, and discounts
leaving less than $0.50 also fail — use 99% off (or price − $0.50 max discount).

## Stripe account gotchas

Alex has multiple Stripe accounts, two formerly both named "Immel Consulting LLC". The correct
account (payment link, coupons, secret key must ALL live here) is `acct_1MRh0gKjxEB5kBDn`,
renamed "Next Level Negotiation". Stripe object IDs embed the account fingerprint (the chars
after the 6-char unique part match the account ID tail) — useful to detect wrong-account objects.
After-payment redirects: the $47 script link → `https://<domain>/script?session_id={CHECKOUT_SESSION_ID}`;
**both** session-tier links → `https://<domain>/booking?session_id={CHECKOUT_SESSION_ID}`.

## Script content rules (Alex's voice — do not regress)

Concise spoken lines (1–2 sentences; long scripts sound rehearsed). Collaborative, never
defensive — Accusations Audit names the awkward thing then stops, no self-justification.
Intro: Alex introduced as founder & CEO, anchor as a markdown comp table with annualized equity
(assume 4-year vesting if unstated), trust-your-gut/don't-act-from-fear note. NLN calibrated
questions (hiring-team feedback early; "How did you come to this offer?" pre-counter; "best you
can do without putting yourself in a bad position" for objections). Clear open questions before
negotiating. No day-specific timing advice unless the deadline confirms a safe window.
Industry lens (tech=base/equity; healthcare/gov/nonprofit=non-salary levers; finance/legal=
bonus/sign-on) never overrides actual offer data. Paid-session mentions link
`STRATEGY_SESSION_URL` (`src/lib/config.js`) — a Negotiation Strategy Session, never called a
"free consult" or a "quickie". As of the JobJenny pilot this books time with the JobJenny team
(Jenny/Alisa), not Alex; the script-generator prompt gets the same URL substituted in at request
time (`{{strategy_session_url}}` in `script-generator-prompt.md`, filled by
`api/generate-script.js`) so it's a one-place update, not two. No fake urgency, no crossed-out
prices.

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
