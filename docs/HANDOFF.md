# Handoff log

Every agent (and human) appends an entry here **at the end of each work session**,
newest at the top. This is how Claude, Codex and Gemini pick up where the last one
left off without redoing or undoing work.

Template:

```
## YYYY-MM-DD — <Agent name> — <short title>
Branch/PR: ai/<agent>/<topic>  (#PR number if opened)
Changed: what you did, which files/areas
Why: the request or reason
Verified: what you ran (npm run check, screenshots at desktop/mobile…)
Not done / known issues: anything unfinished or broken
Next agent should: concrete next steps
```

---

## 2026-10-03 — Claude (Opus) — MVP v0.1.0 built from an empty repo

Branch/PR: initial commit on `main` (repo was empty); restore-point branch `stable/2026-10-03-mvp` (tags can't be created from the build sandbox).

Changed: everything — web app (17 panels), API server, free data adapters, Kuartal ID login, Pro gating,
mobile shell + PWA, Tauri desktop wrapper, Docker + Cloudflare Tunnel deploy, CI, guardrails, docs.

Why: Diemas asked for a Kuartal-branded, Bloomberg-style terminal (inspired by kuantara.id and Koyfin)
at terminal.kuartalsystems.com — free for Kuartal ID users, premium panels for Pro, zero running cost,
AI assistant placeholder, web + desktop + simpler mobile.

Verified:
- `npm run check` green: 33 server tests + 21 web tests, typecheck, production build, guardrails.
- Production server smoke-tested; all endpoints answer in < 250 ms with upstreams unreachable (demo fallback).
- Screenshots reviewed at 1600×960 desktop and 390×844 mobile.
- Production-only install of the runtime image stage tested (6.7 MB node_modules).

Not done / known issues:
- **Live upstreams were not reachable from the build sandbox**, so live Yahoo/Binance/RSS/Treasury/
  World Bank responses were verified only against recorded payload fixtures. First real deploy: open
  every panel and confirm the badge says LIVE/DELAYED/EOD, not DEMO. If a source returns DEMO in
  production, check `server/src/providers/*` against the real response.
- Docker image build and the Tauri desktop build were not run here (no registry/WebKit access) — CI runs both.
- Kuartal ID login needs an OAuth client created on id.kuartal.id (see docs/DEPLOY.md) before the
  login button appears; until then the site runs in guest mode.
- Yahoo Finance's chart endpoint is unofficial — fine for a free tool, must be replaced before
  charging for equity data (see docs/DATA_SOURCES.md).
- Mobile: command-bar actions that "open a panel" add it to the desktop workspace; on mobile only the
  chart-focus action is visible. Improve by routing open-panel actions to the More tab on mobile.

Next agent should: see `docs/ROADMAP.md` (prioritised).
