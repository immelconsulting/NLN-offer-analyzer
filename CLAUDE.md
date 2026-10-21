# NLN Offer Analyzer — Project Guide

AI-powered salary negotiation funnel for Next Level Negotiation (NLN), founded by Alex Immel
(alex@nextlevelnegotiation.com). React 18 + Vite + Tailwind, deployed on Vercel at
**https://www.jobofferanalyzer.com** (added Oct 15, 2026; GoDaddy DNS, apex redirects to www).
The old https://nln-offer-analyzer.vercel.app still serves the same app and must keep working,
since scripts downloaded before the switch link there (repo: immelconsulting/NLN-offer-analyzer,
deploys from `main`).
Alex is non-technical: explain changes in plain English and give click-by-click steps for
dashboards (Stripe, Vercel, Trustpilot).

## Current status (Oct 20, 2026; launching with JobJenny the morning of Oct 21)

Two products ship from this funnel, both live with real Stripe payments:

1. **$47 self-serve script** (one per flow: counter-offer, screening-call, offer-call).
2. **Negotiation Strategy Session with Jenny Foss** ($199 / 30 min, $319 / hour; the hour was $329 until Oct 20, 2026). Live Payment
   Links `STRATEGY_SESSION_30MIN_CHECKOUT_URL` / `_60MIN_` in `src/lib/config.js` were made in
   the Stripe dashboard on Oct 10 (so their Prices have **no lookup key**; the tier is read from
   the Price amount, see item 9). Each tier reveals its own Thryv calendar on `/booking`, and
   every purchase emails `info@jobjenny.com` (item 10).

**Launch-ready (Oct 20):** all flows signed off (no further audit notes coming from Alisa), free-test
mode off, 60-minute session repriced to $319. Still open: `JENNY_BIO_URL` is a temporary team-page link. `scripts/create-session-payment-links.js`
was written for creating the links but never run; keep it only as a reference for the shape.

**JobJenny pilot:** sessions are run by **Jenny Foss**, not Alex, and she's named (with a bio link)
on every "book a session" decision point. Alisa runs JobJenny's operations. Most `/session`
visitors are JobJenny coaching clients sent there straight after their resume/LinkedIn work —
see item 8 below, that audience drives the page's copy rules. There is no free-consult path
anywhere in the funnel; every "talk to a human" CTA leads to a paid tier.

## Funnel (script path verified end-to-end, including a real Stripe payment)

1. `/` **LandingPage** — hero + required email + job-search stage question + an unchecked
   marketing opt-in checkbox (compliance: email is required only to deliver results; marketing
   needs the explicit opt-in). Every lead (email/stage/marketingOptIn/timestamp) is POSTed to
   `/api/lead` (Upstash Redis list `nln:leads`). CSV export: `GET /api/leads?token=<LEADS_EXPORT_TOKEN>`
   (pre-checkbox leads export as opt-in "no"). Privacy Policy lives at `/privacy`
   (`src/components/PrivacyPolicy.jsx`), linked near the email field.
2. Branch (`STAGE_ROUTES` in LandingPage): **"Received an offer"** → `/offer`, **"Applying"** →
   `/apply`, **"Interviewing"** → `/interview` (those two share one flow, below), **"Expecting
   an offer soon"** → `/offer-soon` (its own flow, below). All four stages now have a real
   path; `/thanks` still renders for any old link but is no longer reachable from the landing
   page.
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
   rendered with react-markdown, plus a feedback mailto. **One payment = one script:** the first
   script for a checkout session is saved at `nln:script:<session_id>` (2-year TTL), and any
   later request for that session returns it (`reopened: true`) with no model call and no
   offer data needed, so the same `/script?session_id=` link works on any device. The first
   time, the buyer (Stripe `customer_details.email`) is emailed the script plus that link via
   Resend (`sendScriptEmail` in `api/_lib/email.js`). `test_skip_payment` is never saved or
   emailed. **The payment says which analysis it bought:** the proof page sends buyers to Stripe
   via `checkoutUrl()` (`src/lib/checkoutUrl.js`), which adds `client_reference_id=<submissionId>`
   and `prefilled_email=<landing-page email>`. The generator loads that submission record and
   prefers it over the localStorage stash, so the first visit works on another device/browser and
   can't pick up a second analysis from another tab. Payments without a reference (pre-Oct 18)
   fall back to the stash. Session tier links get `prefilled_email` too, so Jenny's alert matches
   their analyzer history. **Download PDF** builds a real PDF client-side with pdfmake (`src/lib/scriptPdf.js`,
   markdown → pdfmake; 🗣️ becomes "Say:" since Roboto has no emoji; includes the AI
   disclaimer). It builds the PDF **once** (`getBlob`), saves it with a plain `<a download>` and
   points a tab, opened synchronously in the click so pop-up blockers allow it, at the same blob
   URL. pdfmake is lazy-loaded (prefetched once a script is shown). **It never opens the print
   dialog on its own** (Alex, Oct 20: buyers kept landing in print): on failure it shows a short
   message with an optional "Print or save as PDF instead" link and records `script_pdf_failed`
   with the error text, so a device-specific failure shows up in the admin data.
   The script's own sign-off links directly to `STRATEGY_SESSION_URL` (not `/session`), since it
   must still work when the script is downloaded/printed as a standalone PDF outside the app.
   The prompt holds a `{{strategy_session_url}}` placeholder that `api/generate-script.js`
   substitutes at request time, so the booking URL lives only in `src/lib/config.js`.
8. `/session` **SessionProofPage** (added Sept 2026, structurally mirrors ProofPage) — sells the
   paid Negotiation Strategy Session as two tiers, each linking its own Stripe Payment Link:
   $199 / 30 min (`STRATEGY_SESSION_30MIN_CHECKOUT_URL`) and $319 / hour
   (`STRATEGY_SESSION_60MIN_CHECKOUT_URL`, visually featured as "Most support"). Every in-app
   "book a session" CTA (ResultsPage, ProofPage's secondary CTA, ScriptPage's post-script
   upsell, ThankYou's dead-end pages) routes here rather than linking a booking URL directly.
   **Audience — this drives the copy:** mostly JobJenny coaching clients sent here right after
   their resume/LinkedIn work, not cold traffic, and often people who never touched the
   self-serve script. So the copy leans on the JobJenny relationship and must **never** frame a
   session as the better choice over the script — for most visitors the script isn't what
   they're weighing it against. Don't sync this page's copy to ProofPage's. **The copy is Jenny
   Foss's own** (her "Sales Page for Jenny Consulting" doc, Oct 19, 2026: "Let's get you paid what
   you're worth.", four ✓ points, "Ready? Choose your session with Jenny."), kept word for word;
   change it only with Jenny/Alex's say-so. One page serves all four flows. No Trustpilot block
   here (JobJenny has no Trustpilot presence); the testimonial slot is an empty comment
   placeholder — a real quote from Jenny/Alisa's practice can fill it, but never reuse
   ProofPage's script testimonial, which is about the script product.
9. `/booking` **BookingPage** — post-payment destination for both session tiers. Stripe redirects
   here with `?session_id={CHECKOUT_SESSION_ID}`; the page POSTs to `/api/verify-payment`,
   which expands the session's line items and resolves the tier with `strategySessionTier()`
   (`api/_lib/payment.js`): the Price's `lookup_key` if set, else its `unit_amount`
   (19900 / 31900, plus the old 32900 hour price for any payment made on the retired $329 link;
   unaffected by promo codes; the live dashboard-made Prices use this path).
   It returns that tier's Thryv link from `SESSION_TIERS` in config.js. A paid session with no
   session tier (e.g. a $47 script purchase) gets no calendar. The Thryv URLs are only read
   server-side, so they don't ship in the browser bundle. Test with
   `/booking?session_id=test_skip_payment&tier=30` (or `60`).
   Gating it server-side is deliberate — Stripe *could* redirect straight to the calendar, but
   then anyone who saw the URL could book a paid session for free.
10. **Session purchase alert** — `api/stripe-webhook.js` emails `info@jobjenny.com` (cc Alex)
   via Resend when a session tier is paid, so Alisa can send a welcome within hours. Stripe
   can't do this natively (receipts go to the buyer only). It listens for
   `checkout.session.completed` + `checkout.session.async_payment_succeeded`, re-fetches the
   event from Stripe by id instead of checking a signature, ignores anything that isn't a
   session tier (`strategySessionTier()` in `api/_lib/payment.js`, shared with
   `/api/verify-payment`), and dedupes per checkout in Redis. The alert also carries the
   buyer's **most recent analyzer submission** matched on their checkout email
   (`buildClientContext()` in `api/_lib/clientContext.js`): a per-flow plain-text summary
   (form answers incl. current salary / total comp, analysis highlights) plus `resume.txt`,
   `job-description.txt` and `their-script.txt` attachments when present. Only extracted text
   is ever stored, so attachments are .txt (keeping original files would need Vercel Blob;
   deferred). No match → the alert says so. Disclosed in the privacy policy's JobJenny line.

## Pre-offer flow: Applying + Interviewing (added Sept 20, 2026)

Two of the three dead-end stages, now one real flow. Same shape as the offer path
(short form → free researched analysis → $47 script → Strategy Session CTA), but there is no
offer yet, so the product is a **researched target range** and a **Recruiter Screening Call
Script** instead of a score and a counter-offer script.

**Applying and Interviewing share everything.** They face the identical negotiation moment
(a recruiter asking what you want), so they use one form, one analyzer, one prompt pair, one
results page, one proof page, and one script — parameterized by `flow` (registry in `src/lib/flows.js`).
They stay separate `flow` values so the admin can tell them apart and the copy can diverge
later, but nothing is duplicated: a voice change is one edit, not two, and the two can't drift.
Routes are `/apply`, `/apply/results`, `/apply/proof` and `/interview`, `/interview/results`,
`/interview/proof`. Only the form intro and the proof heading differ; the stage is also passed
into both prompts so the coaching lands in the right place in the process.

- `/apply` and `/interview` **ApplyForm** — deliberately short. Required: target role, location, years of
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
- **Pre-offer submissions never feed `comparables.js`** — they are aspirational targets, not
  real offers. `comparables.js` excludes any `flow` other than `"offer"`, which also covers
  future non-offer stages; the admin salary CSV does the same.
- `/apply/results` **ApplyResultsPage** — range is the hero; also shows sources, biggest risk,
  and the call-status note. Stateless via the same base64 `?d=` param, with `flow: "apply"`
  inside the payload. **The three strategies are deliberately NOT rendered here** — they are
  effectively the script, and giving them away free removes the reason to buy it. They stay in
  the payload because the script generator builds from them.
- `/apply/proof` and `/interview/proof` — ProofPage with the stage as `flow` (copy differs, structure shared, offer flow
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

Shared search loop lives in `api/_lib/analysis.js` (`runSearchAnalysis` + `SOURCES_SCHEMA` +
`RANGE_POINTS` + `STRATEGY_SCHEMA` + `RISK_TO_STRATEGY` + `normalizeRange`), used by all three
analyzers — the `tool_choice: auto` / `pause_turn` / single-nudge behavior and `max_uses: 3`
are defined once there.

**Flow registry:** `src/lib/flows.js` declares all four flows explicitly (id, label, paths,
whether the form uses `targetRole`/`targetCompany`). It replaced an older "pre-offer stages"
grouping that meant two things at once — "has no offer yet" and "uses the screening-call form
and prompts" — which came apart when offer-soon arrived. `SCREENING_FLOWS` is the explicit
`["apply","interview"]` pair; everything else is per-flow. Adding a stage means adding a row
there plus a prompt file, not editing a chain of booleans.

## Expecting-an-offer-soon flow (added Sept 27, 2026)

The last dead-end stage, now a real flow. Same shape as the others (short form → free
researched analysis → $47 script → Strategy Session CTA), but it faces a **different moment**
from Applying/Interviewing: not the screening call where a recruiter asks what you want, but
**the offer call** where a recruiter tells you a number. So it gets its own prompt pair,
endpoint, form, and results content, while riding the same plumbing (search loop, floor math,
proof page, $47 Stripe link, `/script`, storage, admin).

Flow id `offer_soon`. Routes: `/offer-soon`, `/offer-soon/results`, `/offer-soon/proof`.

- **The rule that drives everything:** do not accept the offer and do not counter on the spot,
  on that call. The offer call is for gathering, not deciding: appreciate it, understand it,
  learn how they built it, ask for time, and get it in writing. The counter happens later, off
  this call, through `/offer`. Every scripted line must obey this; the prompt forbids any line
  that accepts a number or proposes a counter.
- `/offer-soon` **OfferSoonForm** — Required: target role, **company** (required here unlike
  the screening-call form, because it buys company-specific salary research), location, years
  of experience, risk tolerance, "Where do things stand on compensation so far?" (`compStatus`:
  not_discussed / recruiter_shared_range / i_shared_number / both_shared) and "Any other
  opportunities in play?" (`otherProcesses`: none / interviewing_elsewhere / expecting_offer /
  have_offer). Conditionals, all optional: recruiter range low/high, what they shared
  (free text so a range fits), and expected comp elsewhere. Optional: call timing, a
  `priorities` multi-select, `currentTotalComp` (same label and rules as the apply form),
  context textarea, resume + job description upload (labelled "Job Description" here, not
  "Example", since the role is specific).
- `/api/analyze-offer-soon` + `offer-soon-analyze-prompt.md` — same search architecture as the
  other analyzers, returning `submit_offer_soon_analysis`: `market_range`, `confidence`,
  `range_rationale`, **`offer_benchmark_note`** (how to read the number when they hear it),
  `biggest_risk`, **`leverage_read`**, `call_status_note`, three strategies,
  `recommended_strategy` (set server-side from risk tolerance), `sources`. **No score.** One of
  the three searches is spent on the named company's pay for the role.
- **Leverage honesty rule:** the analysis and the script may only reference competing
  opportunities the candidate actually reported. `otherProcesses: none` means the script
  contains **no** line about other offers or interviews anywhere — the prompt says so
  explicitly, and the generator passes that instruction through. Never invent leverage.
- **Floors** reuse `applyFloors()` from the apply flow, with the same rule that
  `currentTotalComp` is TOTAL comp and may only be compared against the `total_comp` range,
  never base.
- **Recruiter range check** (`recruiterRangeCheck()` in `generate-script.js`): when the
  recruiter shared a range, the generator compares its high end to the researched range and
  passes one computed line — below the walk-away floor, or below the market target, or nothing.
  The script turns that into a sentence explaining their band is an opening position, not the
  market.
- `/offer-soon/results` **OfferSoonResultsPage** — range hero, then `offer_benchmark_note`, a
  **static** "don't accept, don't counter" callout (static so it can never be dropped or
  reworded by the model), `biggest_risk`, `leverage_read`, `call_status_note`, sources, CTAs.
  **The three strategies are deliberately NOT rendered**, same reasoning as the apply flow:
  they're effectively the script. They stay in the payload for the generator.
- `/offer-soon/proof` — ProofPage with `flow="offer_soon"`; its own heading and proof points
  (it sells a different script), same $47 link and `/script?session_id=` redirect. No
  testimonial; never reuse the counter-offer one.
- `/script` uses `offer-soon-script-generator-prompt.md`. Structure is built from Alex's
  existing Offer Call script kept close to verbatim: Scenario A (they ask first), Scenario B
  (they share a number — two approaches, one recommended by strategy, plus an accusation audit
  and the "range of offers" question), Scenario C (they push for a number — four escalating
  steps ending in the wide-range answer), the current-salary refusal, timeline pushback, a
  recovery section only when they already shared a number, and a blank offer-notes table to
  fill in live. Voice rules match the apply prompt: **no em dashes, no double hyphens**, and
  additionally **no named weekdays** for the follow-up (bracketed placeholders instead).
- Shared results building blocks live in `src/components/RangeBlocks.jsx`
  (`RangeCard`, `RangeRow`, `SourceList`, `Callout`, `NextStepChoice`, `BrokenResultNotice`),
  used by both range pages so neither forks the other.
- Storage and admin: `flow: "offer_soon"`, same record shape. `comparables.js` already excludes
  anything that isn't `"offer"`, and the admin salary CSV is still offer-rows only.

## Cross-cutting notes on the forms and prompts

**Form drafts** (`src/lib/formDraft.js`): all three forms (offer, screening-call, offer-soon)
save every text field to sessionStorage as you type and prefill from it, so switching stages
doesn't mean retyping. Role/company mirror across the two names (`role` ↔ `targetRole`) so the
most recent edit wins in both directions. `currentSalary` (offer: base) and `currentTotalComp`
(pre-offer: total) are deliberately **not** shared — different questions, and crossing them
would corrupt the floor math. Uploaded files are excluded: a 2MB upload is ~2.7MB of base64 and
two would exceed the ~5MB quota, so files must be re-picked. The offer-soon `priorities`
multi-select is also excluded, since the draft store keeps strings only.

**No em dashes anywhere customers can see (Alex, Oct 20, 2026: "it looks like AI wrote it").**
All six prompts forbid them (a `## PUNCTUATION` section in the analyzers, a formatting rule in the
scripts) and the prompt files themselves contain none. That's load-bearing: when the instructions
used em dashes in their own prose, the model mirrored the style and produced 7 of them in a
script. Safety net: `stripEmDashes()` (`api/_lib/text.js`) rewrites any that slip through, on every
analysis (in `runSearchAnalysis`) and every script (new and reopened); en dashes in ranges and
markdown `---` are untouched. Site copy is also dash-free; `tests/no-em-dashes.test.js` enforces
all three (the private admin page is exempt). Write new copy with commas, periods, colons or
parentheses instead.

**Loading screen** (`src/components/AnalysisLoading.jsx`, shared by all three forms): cycles
every 7s through what the analyzer is doing, built from the form (role, location, company,
years): BLS, Glassdoor, the specialist sources only when the role matches (Levels.fyi/Built In
for tech, RepVue/Betts for revenue, mirroring the prompts' routing), then the three strategies,
holding on the last step. **Results pages** have "Print these results" (window.print; the share
row and the script/session choice are `print:hidden`). **Footer** (`SiteFooter.jsx`, rendered once
in `App.jsx`) on every page links www.nextlevelnegotiation.com and the privacy policy.

**Offer analysis next step:** defaults to **emailing the recruiter** to thank them and ask for a
time to talk it through, never a call made only to schedule another call (Alex, Oct 20). The rule,
the example in `system-prompt.md` and the `recommendedNextStep` schema description all say so;
`tests/prompts.test.js` guards it.

**Script price copy** (ProofPage): "Limited-time price" / "This rate may go up soon. Lock it in
before your next negotiation call." It replaced "Founding member / early access price", which
read as too new; keep urgency honest (no countdowns, no crossed-out prices). Session mentions
say Jenny **helps them prepare before** their calls, never that she's on the call.

## Submission storage & admin (added July 26, 2026)

Every successful analysis persists to Upstash: `nln:sub:<id>` records (form + analysis +
script when generated), indexed by `nln:subs` (newest first) and `nln:subs:email:<email>`.
Append-only history; email comes from the landing-page session (`leadEmail` in the analyze
payload). `analysis.submissionId` rides inside the encoded `?d=` data so `/api/generate-script`
can attach the script to the same record. Storage failures never block users.
**The Upstash database is on the free plan: no automatic backups** (Alex's choice, Oct 18, 2026).
He exports it by hand from Upstash → Backups → Export every couple of weeks; the free plan's
monthly command cap is the other limit to watch if traffic grows.

Pre-offer submissions store the same way with `flow: "apply"`, `"interview"` or `"offer_soon"`; offer
records predate the field, so anything unmarked is an offer.

`/admin` (route, not linked anywhere) — password login (`ADMIN_PASSWORD`, falling back to
`LEADS_EXPORT_TOKEN`) exchanged for an httpOnly session cookie by `/api/login`; `/api/admin`
requires that cookie and no longer accepts a `?token=` parameter, so no URL grants access.
Date-range filter (today / 7d / 30d / 3m / 4m / 6m / 1yr / custom) drives the funnel rollup, the
submissions table, and both CSV exports together. Sortable spreadsheet table with a Flow column
and an All / Offer / Apply / Interview / Offer-soon filter; visual funnel with per-step percentages. **The salary CSV is
offer-rows only** — pre-offer rows carry target ranges, not real offers.

The analyzer feeds anonymized aggregates of similar past submissions into the prompt
(`api/_lib/comparables.js`: synonym+token title matching, city match, IQR outlier filtering;
median-only at 3-4 samples, range at 5+; requester's own email excluded). The server sets
`analysis.internalDataUsed`; results page shows a subtle caption when true. Never pass
identifying details into another user's analysis — aggregates only.

- `system-prompt.md` / `script-generator-prompt.md` / `apply-analyze-prompt.md` /
  `apply-script-generator-prompt.md` / `offer-soon-analyze-prompt.md` /
  `offer-soon-script-generator-prompt.md` — all six prompts are file-based, read at request
  time through `loadPrompt()` (`api/_lib/prompts.js`), which **throws** on a missing or empty file
  rather than falling back to a generic prompt (that would sell a script or show an analysis
  built without NLN's rules). `vercel.json` bundles `*-prompt.md` via `includeFiles` on the four
  functions that read them.
- `src/lib/config.js` — every external URL and price label in one place: the $47 script Stripe
  link, the two session-tier Stripe links, the two per-tier Thryv links (`SESSION_TIERS`), `STRATEGY_SESSION_URL` (the
  absolute `/session` URL used by generated script PDFs — absolute because a relative link is
  dead once the PDF leaves the site), price labels, Trustpilot URL, contact email, `JENNY_BIO_URL` (temporary: JobJenny's
  team page; linked via `MeetJennyLink.jsx` on every "book a session with Jenny" decision
  point), and the `FREE_TEST_MODE` flag.
- `api/analyze.js`, `api/analyze-apply.js`, `api/analyze-offer-soon.js`,
  `api/generate-script.js`, `api/verify-payment.js`, `api/lead.js`, `api/leads.js`,
  `api/admin.js`, `api/login.js`, `api/event.js`, `api/stripe-webhook.js` — **11 Vercel
  functions; the Hobby plan caps at 12**, so only one slot remains before the plan matters. Shared helpers live in `api/_lib/` (underscore = not deployed as functions):
  `store.js` (Upstash), `comparables.js`, `extract.js`, `email.js` (Resend), `analysis.js` (the shared web-search
  loop), `auth.js` (admin sessions), and `payment.js` (one Stripe checkout verifier, used by
  both the script and the session booking gate).
- Brand: navy scale in `tailwind.config.js` (#001E34 / #16163F / #0099CC / #6BCCF7 / #D8F0F8),
  logos in `src/assets/`, Trustpilot green #00B67A for stars.

## Admin dashboard and per-person tracking (added Oct 18, 2026)

`/admin` is a dashboard: filter bar (date range, flow, search), a "Hidden people" list, KPI tiles,
a drawn **script funnel** (Attract / Inform / Convert bands) and **session funnel**, a by-flow
breakdown, one person's **journey timeline**, and the submissions table (click an email for that
person's journey). Components in `src/components/AdminDashboard.jsx`.

- **Tracking** (`src/lib/track.js` → `/api/event` → `api/_lib/events.js`): every event carries a
  random visitor id (`localStorage["nln:vid"]`) and the flow from the URL. Stored one Redis list
  per UTC day (`nln:ev:<day>`, ~13-month TTL). `/api/lead` links visitor id → email
  (`nln:vidmap`) and records `lead_captured`. Purchases are recorded **server-side only**, once
  per checkout (`recordPurchaseOnce`): `script_purchased` in `generate-script.js` (email = the
  submission's analyzer email, else Stripe's) and `session_purchased` in the webhook. Buyer names
  from Stripe go to `nln:names`. The browser can't send purchase events (`CLIENT_EVENTS`
  allowlist). The old anonymous counters (`nln:events*`) are no longer written or read.
- **Counting** (`api/_lib/dashboard.js`, pure, fully tested): groups events into **people**
  (email if known, else visitor id) and counts people per step, so refreshes don't inflate.
  Filters apply per person: a flow filter keeps everything those people did.
- **Clickable funnels:** each layer is a button. Clicking lists who **reached** the step and who
  **stopped after the step above** (`people` / `droppedOff` on each step from `funnelCounts()`,
  newest activity first, capped at 300 each; counts stay exact). Clicking a person opens their
  journey; anonymous visitors use `?person=visitor:<id>`.
- **Hidden people:** `nln:admin:excluded` (emails or `@domain`), managed from the page
  (`POST /api/admin`). Anything sent while logged in to `/admin` is tagged `internal` and that
  person is hidden automatically. Exclusions apply to KPIs, funnels, the table and CSVs.
- Detailed tracking starts Oct 18, 2026 (`TRACKING_SINCE` in `api/admin.js`); earlier activity was
  anonymous only. Disclosed in the privacy policy (usage data line, effective Oct 18).

## Rate limits (added Oct 17, 2026)

`api/_lib/rateLimit.js`: per-IP daily caps in Redis (`nln:rl:<bucket>:<UTC day>:<ip>`):
**10 analyses/day shared across all four analyzers** (Alex's call; each one costs real money in
web searches and model calls), 30 leads/day, 500 events/day. Over the cap → 429 with a friendly
message the forms already display. Logged-in admins are exempt (the `nln_admin` cookie is
`Path=/`), and it fails open if Redis is down. Checked after validation, so a rejected form
doesn't use up an attempt. No CAPTCHA by design: friction for JobJenny's clients, and the cap
covers the real risk (cost). Backstop: a monthly spend limit on the Anthropic account.

## Environment variables (Vercel)

`ANTHROPIC_API_KEY`, `KV_REST_API_URL` + `KV_REST_API_TOKEN` (Upstash marketplace integration;
code also accepts `UPSTASH_*` names), `STRIPE_SECRET_KEY`, `LEADS_EXPORT_TOKEN`,
`ALLOW_TEST_BYPASS` (temporary, see below), `RESEND_API_KEY` + optional `SESSION_ALERT_TO` /
`SESSION_ALERT_FROM` (session purchase alerts) / `SCRIPT_EMAIL_FROM` (buyer script emails).

## Testing without paying

`session_id=test_skip_payment` skips Stripe verification, **always on non-production (Vercel
preview) deployments** and in production only while `ALLOW_TEST_BYPASS=true`. **Free-test mode
was turned off for launch on Oct 20, 2026:** `FREE_TEST_MODE = false` hides the two "[Testing]"
links ("Generate my script free" on `/proof`, "Skip payment (30 / 60 min booking step)" on
`/session`), and `ALLOW_TEST_BYPASS` was removed from production in Vercel. To test without paying
now, use a branch's preview deployment (behind Vercel login), or a 99%-off promo code in production.
Stripe promo-code testing: 100%-off codes are rejected on one-time Payment Links, and discounts
leaving less than $0.50 also fail — use 99% off (or price − $0.50 max discount).

## Stripe account gotchas

Alex has multiple Stripe accounts, two formerly both named "Immel Consulting LLC". The correct
account (payment link, coupons, secret key must ALL live here) is `acct_1MRh0gKjxEB5kBDn`,
renamed "Next Level Negotiation". Stripe object IDs embed the account fingerprint (the chars
after the 6-char unique part match the account ID tail) — useful to detect wrong-account objects.
After-payment redirects (moved to the new domain Oct 15: the $47 link is confirmed working there;
the two session links and the webhook were handed to Alex to update and are **not yet
confirmed**; the old vercel.app URLs keep working either way): the $47 script link → `https://www.jobofferanalyzer.com/script?session_id={CHECKOUT_SESSION_ID}`;
**both** session-tier links → `https://www.jobofferanalyzer.com/booking?session_id={CHECKOUT_SESSION_ID}`.
Webhook endpoint: `https://www.jobofferanalyzer.com/api/stripe-webhook` (must be `www.`; Stripe
doesn't follow the apex redirect). Events: `checkout.session.completed`,
`checkout.session.async_payment_succeeded`. The checkout page's header shows the account's public
business name (was "Immel Consulting LLC", showed "Next Level Negotiation" by Oct 18); a name
mismatch there is not by itself a wrong-account sign.

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
"free consult" or a "quickie". As of the JobJenny pilot this books time with Jenny Foss, not
Alex; the script-generator prompt gets the same URL substituted in at request
time (`{{strategy_session_url}}` in `script-generator-prompt.md`, filled by
`api/generate-script.js`) so it's a one-place update, not two. No fake urgency, no crossed-out
prices.

**Compliance copy (required — never remove):** AI-disclosure lines below the CTAs on the landing
page, offer form, and results page ("uses AI, guided by NLN's negotiation methodology" — never
claim the AI is "trained on" NLN material), and an AI-disclosure + not-professional-advice
disclaimer on the script page (which intentionally prints in the PDF). These support Anthropic
AUP requirements for consumer-facing employment-related advice (disclosure at session start).

## Checks and tests (added Oct 18, 2026)

**Before pushing any change, run `npm run check`** (= `npm run lint && npm test && npm run build`)
and fix anything red. GitHub Actions (`.github/workflows/ci.yml`) runs the same three on every pull
request and every push to `main`, with no secrets.

- Tests live in `tests/` (Vitest, `vitest.config.js`). They fake Stripe, Claude, Redis and Resend
  with `vi.mock`, so they never charge, email or touch customer data. Covered: session tier and
  booking gate, the floor / recruiter-range / wide-range money math (`applyFloors`,
  `recruiterRangeCheck`, `wideRangeAnswer` are exported from `generate-script.js` for this),
  one-payment-one-script and the `client_reference_id` precedence, daily limits, the checkout URL,
  result encoding, the script PDF, Jenny's alert summaries, admin session signing, every prompt
  file (loads; the two pre-offer script prompts contain **no em dashes or `--`**; script prompts
  keep `{{strategy_session_url}}`), and that every `/api` function imports.
- **When you change behavior, change or add the test in the same commit.** A rule in this file
  that can be checked (a voice rule, a money rule) should also be a test.
- Lint (`eslint.config.js`) is bug-catching only: undefined names, unused code, React hook rules.
  `exhaustive-deps` is a warning. Locally ESLint and git can take ~30s on the Desktop folder;
  that's the filesystem, not the tools.

## Local development quirks

- `npm run dev` serves only the frontend — `/api` functions 404 locally (no Vercel CLI installed).
  Test API handlers by importing them in Node with mock req/res objects and `test_skip_payment`.
- `npm run build` / `git add` occasionally hang or bus-error (stale `.git/index.lock` once needed
  removal). Vite can take 60–90s to bind. Local builds are optional; Vercel builds on deploy.
- Commits are pushed straight to `main` for small changes; use a branch + Vercel preview URL when
  Alex wants to test on his phone first.
