# AGENTS.md — rules for every AI and human working on this repo

> **Read this whole file before changing anything.** It applies equally to
> Claude, OpenAI Codex, Google Gemini, Copilot and humans. `CLAUDE.md` and
> `GEMINI.md` just point here. If anything you're asked to do conflicts with
> this file, **stop and ask Diemas** (the owner) instead of guessing.

## What this repo is

**Kuartal Terminal** — a free, Bloomberg-style market-insight terminal for
Kuartal ID account holders, with Pro panels for paid members. Production URL:
`https://terminal.kuartalsystems.com`. Owner: Diemas (PT Kuartal Financial Group).

It ships three ways from one codebase:
- **Web** (`web/`) — React workspace with draggable panels, command bar, Ask Kuartal.
- **Mobile** — the same web app below 760px renders `MobileShell` (bottom tabs). Installable as a PWA.
- **Desktop** (`desktop/`) — Tauri window around the production URL. Built by GitHub Actions.

Hard product constraints from the owner — do not violate:
1. **Costs nothing to run**: no paid data feeds, no paid AI APIs, no licensed content. Only free/public sources (see `docs/DATA_SOURCES.md`). If a feature needs money, propose it in `docs/ROADMAP.md` — don't build it.
2. **Honest data labels**: every API response carries `source` (`live|delayed|eod|static|demo`) and the UI shows it. Never present demo or stale data as live.
3. **Not investment advice**: no buy/sell recommendations or price targets anywhere (including Ask Kuartal). Research and decision-support only.
4. **Kuartal brand**: navy `#0b1319`/`#18333d`, green `#36cc64`, Poppins for headings, mono for numbers. Tokens live in `web/src/styles/theme.css` and come from the `kuartal-id/kuartal-brand` repo.
5. **Out of scope here**: regional/sector/geospatial data (that's the separate *Kuartal Data* app), crowdfunding, the business marketplace.

## Golden rules (all agents)

1. **Never push to `main`.** `main` is production. Create a branch named `ai/<agent>/<topic>` (e.g. `ai/codex/add-etf-panel`), commit there, open a pull request. Diemas merges.
2. **Never** force-push, rewrite published history, delete branches/tags you didn't create, or delete the `stable/*` restore-point tags.
3. **Stay in scope.** Only touch files your task needs. No drive-by reformatting, renaming, moving files, or "cleanups". No mass dependency upgrades unless that *is* the task.
4. **Protected paths** (listed in `.ai/protected.txt`) need owner approval. CI fails if they change without the `owner-approved` PR label. Explain in the PR why you need to touch them.
5. **Stable contracts** (`.ai/contracts.json`) must not break: panel codes, the `localStorage` key, API routes, the Pro entitlement name. Users' saved layouts and other Kuartal apps depend on them.
6. **Green before commit.** Run `npm run check` (typecheck + tests + build + guardrails). Don't commit red. Don't delete or weaken tests to make them pass — fix the code, or ask.
7. **Add tests** for new logic (parsers, scoring, command parsing). Pure functions get unit tests; new API routes get a case in `server/test/api.test.ts`.
8. **No secrets in git.** Config comes from environment variables (`.env.example` lists them). Never commit `.env`, keys, tokens, or passwords.
9. **Log your work.** Append an entry to `docs/HANDOFF.md` (template inside) describing what you changed, why, what's unfinished, and anything the next agent must know.
10. **Commit messages** say what and why, and end with a trailer naming the agent, e.g. `Agent: Codex` / `Agent: Gemini` / `Agent: Claude`.
11. **When unsure, ask.** A question costs minutes; a broken production deploy costs users.

## Commands

```sh
npm install            # once
npm run dev            # API on :8787 + web on :5173 (proxying /api and /auth)
DATA_MODE=demo npm run dev   # offline, no upstream calls
npm run check          # typecheck + tests + build + guardrails — run before every commit
npm run build && npm start   # production build served from :8787
```

## Map of the code

```
shared/            Types + instrument list + math, used by BOTH server and web
  types.ts         ⚠ API contract (protected)
  instruments.ts   Symbol universe, LQ45 list, aliases ("rupiah" → IDR=X)
  math.ts          Pure helpers (sma/ema/rsi/correlation/seeded random)
server/src/
  index.ts         All HTTP routes (Hono). Rate limit, security headers, static hosting
  config.ts        ⚠ Env config (protected)
  auth.ts          ⚠ Kuartal ID OIDC login + session cookie (protected)
  cache.ts         TTL cache with in-flight de-dup + stale-on-error
  providers/       One file per upstream source. Pure parse* functions are unit-tested
  services/        market.ts (which provider serves which symbol), pulse.ts, analytics.ts, news.ts
server/test/       Vitest. fixtures/ hold recorded upstream payloads
web/src/
  lib/panels.ts    Panel catalogue (codes, titles, sizes, keywords) — codes are a contract
  lib/store.ts     ⚠ Workspaces/watchlist state persisted in localStorage (protected)
  lib/assistant.ts Command-bar mnemonics + Ask Kuartal rule-based provider + AI seam
  panels/          Panel components; registry.tsx maps code → component
  components/      Shell (desktop), MobileShell, Workspace grid, CommandBar, PanelFrame
desktop/           Tauri wrapper (loads production URL)
docs/              Architecture, data sources, deploy, AI plan, roadmap, handoff log
.ai/               protected.txt + contracts.json — read by CI
```

## How to do common things safely

**Add a panel**
1. Pick a new 2–4 letter code not used before (never reuse an old code).
2. Add metadata to `PANELS` and `PANEL_ORDER` in `web/src/lib/panels.ts`.
3. Write the component in `web/src/panels/<area>.tsx` taking `PanelProps`; call `report({ source, provider, asOf })` when data loads.
4. Register it in `web/src/panels/registry.tsx`.
5. Add the code to `.ai/contracts.json` → `panelCodes` (that file is protected, so note it in the PR).
6. If Pro-only: set `pro: true` and wrap the body in `<ProGate type="…">`; put its API under `/api/pro/*`.

**Add a data source**
- New file in `server/src/providers/` with a pure `parseX()` and a fetcher using `fetchJson/fetchText` from `http.ts`.
- Record a real response into `server/test/fixtures/` and unit-test the parser.
- Always fall back to labelled demo data (`providers/demo.ts`) or a clear error — never hang, never fake "live".
- Add it to `docs/DATA_SOURCES.md` with its licence/terms. **It must be free and allow display.**

**Change the persisted layout format** (`store.ts`)
- Bump `STORAGE_KEY` (e.g. `:v2`), write a migration from v1 in `load()`, update `.ai/contracts.json`, get owner approval.

**Plug in a real AI model** — see `docs/AI.md`. Implement `/api/ai/ask` server-side; the web client already falls back to rules on any error.

## Before you open the PR — checklist
- [ ] Branch is `ai/<agent>/<topic>`, not `main`
- [ ] `npm run check` passes locally
- [ ] Only files related to the task changed
- [ ] New logic has tests
- [ ] No secrets, no paid services, data labelled honestly
- [ ] `docs/HANDOFF.md` updated
- [ ] UI checked at desktop width **and** ~390px mobile width
