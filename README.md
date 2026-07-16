# Next Level Negotiation — Offer Analyzer

Lead-capture and monetization funnel for [Next Level Negotiation](https://www.nextlevelnegotiation.com):
a free AI offer analysis feeding a paid ($47) personalized counter-offer script, with an expert
path to 1:1 coaching.

**Flow:** landing page (email + job-search stage) → free offer analysis with three strategies →
proof page → Stripe checkout → AI-generated counter-offer phone script. Visitors without an offer
get stage-matched PDF prep resources instead.

Built with React 18 + Vite + Tailwind, deployed on Vercel. Anthropic API powers the analysis and
script generation; Upstash Redis stores leads; Stripe Payment Links handle payment (verified
server-side before script generation). Shareable results are stateless — encoded entirely in the URL.

See [CLAUDE.md](CLAUDE.md) for the full architecture, environment variables, testing notes, and
operational gotchas.

## Local development

```bash
npm install
cp .env.example .env.local   # add keys (see .env.example for the full list)
npm run dev                   # frontend only — /api functions run on Vercel
```

The `/api` serverless functions don't run under `npm run dev`; deploy to a Vercel preview (push a
branch) to test the full stack, or invoke handlers directly in Node with mock req/res objects.

## Prompts

- `system-prompt.md` — the offer analyzer prompt (structured JSON via tool use)
- `script-generator-prompt.md` — the paid counter-offer script prompt (markdown output)

Both are read at request time; edit and redeploy to change behavior.

## Deployment

Push to `main`; Vercel auto-builds the Vite frontend and `/api` serverless functions. Branch
pushes create preview deployments for testing before merging.
