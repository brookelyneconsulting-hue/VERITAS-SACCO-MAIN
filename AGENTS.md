# AGENTS.md

## Project Overview

Veritas SACCO — a Vite + React frontend that connects to a hosted Supabase backend
(database, auth, edge functions, storage). The app source lives in `veritas_recode/`.

## Setup

The project is a standard Vite SPA. It does NOT run a local backend — all data and
auth go through the hosted Supabase project at `https://znwkhhznjdzgbdudmkvf.supabase.co`.

### Required environment variables

- `VITE_SUPABASE_URL` — already known, set in `.env.base44-defaults`.
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable/anon key. The user must provide
  the real value (Supabase Dashboard → Project Settings → API → anon public key).
  A placeholder is generated for development boot; the app will render but Supabase
  calls (login, data) will fail until the real key is supplied.

### Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

The compose file runs `npm install` then `npx vite --host 0.0.0.0 --port 5173`
inside a `node:22-slim` container with `veritas_recode/` bind-mounted at `/app`.
Port 3000 on the host maps to Vite's 5173.

### Key notes

- The `@/` path alias is configured in `vite.config.js` (resolve.alias) and `jsconfig.json`.
- `.npmrc` sets `min-release-age=7` — npm skips packages published within the last 7 days.
- No lockfile exists; `npm install` generates one on first boot.
- Edge functions (send-email, invite-user, invoke-llm, etc.) are deployed to Supabase,
  not run locally. They need server-side secrets (SERVICE_ROLE_KEY, RESEND_API_KEY,
  OPENAI_API_KEY) configured in the Supabase dashboard.
- The old `AGENTS.md` inside `veritas_recode/` references the Base44 CLI/SDK which is
  no longer used (see `veritas_recode/MIGRATION_README.md`).
