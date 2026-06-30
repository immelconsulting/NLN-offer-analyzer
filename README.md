# Next Level Negotiation — Offer Analyzer

MVP single-page app that analyzes a job offer and generates a personalized
negotiation strategy via the Anthropic API.

## Local development

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npx vercel dev                # runs both the Vite frontend and /api functions
```

`npx vercel dev` is required (rather than `npm run dev`) so the `/api/analyze`
serverless function is available locally — `npm run dev` only runs the Vite
frontend.

## Environment variables

| Variable             | Description                                  |
| --------------------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`  | Server-side only. Never exposed to the client. |

Set this in Vercel under Project Settings → Environment Variables before
deploying.

## System prompt

Edit `system-prompt.md` at the project root to change the analysis prompt.
It's read at request time by `api/analyze.js`.

## Deployment

Push to `main` and import the repo into Vercel (or run `npx vercel`). Vercel
auto-detects the Vite frontend and the `/api` serverless functions.
