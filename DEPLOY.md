# Deploying the HSE pilot (free)

This repo is self-contained: it ships the prebuilt knowledge index (`server/data/corpus.json`)
and seeded database (`server/data/hse.db`), so the host only needs to install + build + start.

> ⚠️ This repo contains real Al-Essa data (observations + Aramco standard text). **Keep it PRIVATE.**
> The OpenAI key is NOT in the repo — set it as an environment variable on the host.

## Render.com (free tier)

1. Push this repo to GitHub (private).
2. On Render → **New + → Blueprint**, select this repo (it reads `render.yaml`).
   Or **New + → Web Service** with:
   - Build: `npm install --prefix server && npm install --prefix web && npm run build --prefix web`
   - Start: `npm start --prefix server`
3. Add the env var **`OPENAI_API_KEY`** in the Render dashboard (the blueprint already sets
   `AI_PROVIDER=openai` and `OPENAI_MODEL=gpt-4o`).
4. Open the Render URL. The dashboard loads the seeded data immediately.

Notes:
- Free tier sleeps after ~15 min idle (first request after is a ~30s cold start).
- Uploaded files reset on redeploy (fine for a demo).
- GPT-4o API calls still bill to your OpenAI account; hosting is free.

## Local run
```
cd server && npm start      # serves API + built UI on http://localhost:3001
```
