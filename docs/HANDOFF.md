## 2026-10-09 — Claude (Opus) — 27 research panels moved from placeholder to real free data

Branch/PR: ai/claude/research-panels-real-data (no protected files touched; no panel codes added or removed).
Context: Codex's PRs #2/#4 registered ~120 Kuantara-style panels, but ~96 were placeholders (a "reserved" note or the
same generic quote table with a changePct-based RISK-ON/OFF label). This batch replaces 27 of them with real analytics.
Changed:
- New server code: `services/ta.ts` (pure indicators, levels, structure, stats, regression, ratio, FX strength, RRG,
  breadth, portfolio back-test), `services/research.ts` (multi-timeframe candles 1D/4H/15M, comparisons, rotation
  universes, breadth universes, vol, futures curves), `services/macroUs.ts` + `providers/fred.ts` (FRED topics with
  funding/recession/net-liquidity gauges), `providers/feeds.ts` (CFTC COT, SEC companyfacts, Polymarket events),
  `routes/research.ts` mounted at `/api/research` (+ `/api/research/sources-status`). Types in `shared/research.ts`
  (deliberately not in protected shared/types.ts).
- Web: `panels/technical.tsx` (TIN TRM MRV SAR MST), `panels/quant.tsx` (STA CHC ARR RBA2 PTS FXS VOL BRD ROT FTS CMS),
  `panels/usmacro.tsx` (URY FNL REC EMP INF DFS FIS EGW + COT CFD PMK), `components/charts.tsx` (SVG charts sized via
  ResizeObserver), registry swapped to these components (codes unchanged → saved layouts keep working).
  Terminal Guide gains a "Data source status" check. Mobile: panels opened from the command bar now show in the More
  tab (was a pre-existing bug: they opened in the hidden desktop grid) via a `kt:open-panel` window event in lib/actions.ts.
Licensing decisions: FRED = US-government series only (ICE BofA/Moody's/S&P/UMich excluded) → CMS is an ETF proxy and
says so. Official feeds (CFTC/SEC/Polymarket) return 502 when unreachable, never demo numbers. Futures curves show
nothing rather than invented curves. Macro gauges computed on demo data are relabelled "Demo data: not real conditions".
Polymarket shown as information only, no links to bet (Kuartal is OJK-supervised).
Verified: npm run check (server 71 + web 21 tests; 30 new in server/test/research.test.ts incl. route tests in demo mode),
guardrails, desktop 1500px + phone 390px screenshots of TIN/TRM/SAR/DFS/ROT/PTS/STA/COT.
NOT verified: any live upstream (sandbox has no outbound access). Parsers are tested against hand-made fixtures in each
source's documented format. After deploy, open Terminal Guide → "Check which sources are reachable", then spot-check
FRED (DFS), CFTC (COT), SEC (CFD with AAPL), Polymarket (PMK), and Yahoo futures symbols (FTS, e.g. CLZ26.NYM).
Still placeholders (69): EFS EQP IAF IFF IOW ISS IPP IVP STK ETD ETF ETP ETS FCA FXP FIP GYC URP CDS CRR AGW CMD OIL
GLF GIS CLS CNT CWT CPR LQM OPT MCS MFL MRL CTA DMI OFL LST CBD MCY MGA MGR GPI GTM POR STR ANR ECO INR MRA MOR NSM SES
GRM NEW CNW ART CPS CPM LVC BTL FCS SDS PTM RBA TRJ MRB MWG WEM. The replaced placeholder components are still
exported from panels/research.tsx (unused) — delete in a cleanup PR once this merges.
Next agent should: (1) verify live sources after deploy; (2) next free-data batch: GYC (Treasury + ECB/BoE/BoJ public
yields), CBD (FRED DFEDTARU/ECBDFR + BI rate), MCS/MRL (composite from Pulse + VOL + CMS + breadth), IPP/IVP (SEC 13F
XML), ETP/CMD/CPR/FXP as proper price matrices, CLS (Binance 24h tickers), ECO (FRED release calendar), EFS (factor
scores from price + SEC fundamentals for US names); (3) keep everything descriptive (no buy/sell).
## 2026-10-09 — Claude (Opus) — Require Kuartal ID login + terminal.access (written 10-04, rebased onto Grok's 10-06 hardening; added userinfo sub check, plain-language login errors, refresh re-check tests)

Branch/PR: ai/claude/require-kuartal-id (owner-approved in chat; touches protected auth.ts, config.ts, shared/types.ts)
Changed: server gate on all /api/* except /api/health and /api/me (401 login_required / 403 access_required);
`Me.access` + `Me.loginRequired`; AccessGate screen (login / no-access) shown before any data loads;
session cookie now encrypted (A256GCM) and holds the Kuartal ID refresh token — entitlements re-checked every
15 min with per-token de-duplication (Kuartal ID rotates refresh tokens with reuse detection); session 30 days.
New env: REQUIRE_LOGIN (default true), ACCESS_ENTITLEMENT (default terminal.access). Production moved to Hostinger
Node.js hosting (see DEPLOY.md). Companion PR: kuartal-id/kuartal-login#1 (adds terminal.access + Terminal Access tier).
Verified: npm run check (39 server + 21 web tests, incl. 6 new gate tests); screenshots of both gate states.
NOT verified: a real login round-trip against id.kuartal.id (needs the OAuth client created on the server).
Next agent should: after the first real login, confirm refresh-token re-check works (Hostinger logs);
consider an admin shortcut on id.kuartal.id listing who has terminal.access.

## 2026-10-06 — Grok Bot — Kuartal ID id_token hardening + red CI fix
Branch/PR: `fix/kuartal-id-hardening` (branch name requested by Diemas instead of `ai/<agent>/<topic>`). Not merged; protected files touched → needs `owner-approved`.
Changed:
- **CI was red on `main`** (`npm run typecheck`: `Type '"Research"' is not assignable to type 'Category'` in `web/src/lib/panels.ts`). Three panels used a non-existent `Research` category; moved them to existing categories (ART → Markets, MRB → Tools, PMK → Analytics). Panel codes unchanged (stable contract). They now show up in the sidebar/catalogue menus again (they were in no category before).
- `server/src/auth.ts`: the id_token is now **required** (was skipped when absent) and verified with `issuer: KUARTAL_ID_ISSUER`, `audience`, `algorithms: ['RS256']`, `requiredClaims: sub/exp/iat/nonce`, 60s clock tolerance; nonce must equal the flow cookie's. Nonce is also sent in the `/oauth/token` body — kuartal-login reads it from there, so before this change **every real Kuartal ID login failed with `reason=nonce`**.
- New `server/test/auth-oidc.test.ts` (8 tests: valid login, nonce mismatch, missing nonce, missing id_token, wrong iss, wrong aud, expired, unknown signing key).
- AGENTS.md: "Kuartal ID integration" status section.
Why: Kuartal ID hardening across all Kuartal apps (Diemas, 2026-10-06).
Verified: `npm ci`, `npm run typecheck` (now green), `npm test` (server 41 + web 21 passed), `npm run build` OK. `node scripts/check-guardrails.mjs` fails only on protected paths (`server/src/auth.ts`, `AGENTS.md`) until `owner-approved`. Not tested against the real id.kuartal.id; no UI change except the 3 panels' menu placement (not visually checked in a browser).
Interaction with open PR #1 (`ai/claude/require-kuartal-id`): this PR only touches the token-request body and the id_token-verification block of `callback()`; PR #1 rewrites session handling/userinfo around it. Expect at most a small textual conflict in `callback()` (keep both: PR #1's session/userinfo code + this PR's mandatory id_token block). PR #1's refresh path does not re-verify id_tokens (fine — it only re-reads userinfo).
Not done / known issues: userinfo `sub` is not cross-checked against the id_token `sub` (left out to avoid conflicting with PR #1's `fetchUserinfo` refactor — add after PR #1 merges). Kuartal ID should bind the nonce at /oauth/authorize (then drop the token-body copy).
Next agent should: 1) merge order: this PR first (CI green), then rebase PR #1; 2) after PR #1, add `info.sub === sub` check in `callback()`; 3) deploy manually per docs/DEPLOY.md and do one real login.

## 2026-10-04 — Codex — Terminal expansion and multi-page UI
Branch/PR: ai/codex/terminal-expansion
Changed: Added multi-page navigation (Dashboard, Markets, Indonesia, Bonds & Rates, Macro, Digital Assets, Research, Tools) while retaining the existing customizable dashboard/workspace system. Added US Markets, Bonds & Rates, Indonesia SBN, Funds & Fixed Income, Market Screener and Asset Class Hub panels. Added explicit Ask Kuartal "Coming soon" messaging. Reworked sidebar category flyouts to use contained menus and made empty workspaces recoverable instead of appearing blank. Added commands for the new sections and registered the new panel codes in the stable contract.
Why: Owner requested a larger Koyfin/Kuantara-style terminal with multiple research pages, a customizable main dashboard, broader US/fixed-income/Indonesian investment coverage, clearer Ask Kuartal status, and fixes to broken sidebar menus/blank states.
Verified: Repository-level inspection completed. Full `npm run check` has not yet been run in this environment because the GitHub-connected editing environment does not provide the repo's Node dependency installation/runtime.
Not done / known issues: Kuartal ID SSO is intentionally not activated in this feature pass. Fund-level NAV/AUM/flow data and Indonesia SBN benchmark/auction feeds are not fabricated; the new panels currently provide validated classifications/research entry points until dedicated free public adapters are implemented. New screener uses quote/momentum data only.
Next agent should: Run `npm install && npm run check`; fix any TypeScript/test issues; visually review desktop and ~390px mobile layouts; then continue expanding the data adapters and connect Kuartal ID after feature coverage is stable.

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
