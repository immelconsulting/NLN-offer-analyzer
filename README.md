# Job Offer Analyzer (Next Level Negotiation)

Live at **https://www.jobofferanalyzer.com**. A salary-negotiation funnel for
[Next Level Negotiation](https://www.nextlevelnegotiation.com): a free AI analysis grounded in
live market research, a paid ($47) word-for-word script, and a paid Negotiation Strategy Session
with Jenny Foss (JobJenny pilot).

**Four paths**, chosen on the landing page: received an offer (score + counter-offer script),
applying and interviewing (target range + recruiter screening-call script), and expecting an offer
soon (range + offer-call script). Each runs: short form → free analysis → $47 script → optional
$199 / $329 session.

Built with React 18 + Vite + Tailwind on Vercel serverless functions. The Anthropic API (with web
search) writes the analyses and scripts; Stripe Payment Links take payment, verified server-side;
Upstash Redis stores leads, submissions and purchased scripts; Resend emails scripts to buyers and
purchase alerts to JobJenny.

See [CLAUDE.md](CLAUDE.md) for the architecture, every flow, Stripe setup, testing notes and
operational gotchas.

## Local development

```bash
npm install
cp .env.example .env.local   # every variable the code reads is listed there
npm run dev                   # frontend only; /api functions run on Vercel
```

The `/api` functions don't run under `npm run dev`. Push a branch for a Vercel preview to test the
full stack, or import a handler in Node with mock req/res objects.

## Prompts

Six prompt files at the project root, read at request time (edit and redeploy to change behavior):

| Path | Analysis | Script |
|---|---|---|
| Received an offer | `system-prompt.md` | `script-generator-prompt.md` |
| Applying / Interviewing | `apply-analyze-prompt.md` | `apply-script-generator-prompt.md` |
| Expecting an offer soon | `offer-soon-analyze-prompt.md` | `offer-soon-script-generator-prompt.md` |

A missing or empty prompt file is an error, never a silent fallback (`api/_lib/prompts.js`).

## Deployment

Push to `main`; Vercel builds the frontend and `/api` functions. Branch pushes create preview
deployments (behind Vercel login) for testing before merging.
