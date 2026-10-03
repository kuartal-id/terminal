# Roadmap — what to build next

Priority order. Everything respects the owner rules: **Rp0 running cost, free data only,
honest labels, no investment advice**. Items that need money are in the last section.

## P0 — Launch (do first, mostly configuration)
1. **Deploy** to the home server behind Cloudflare Tunnel (`docs/DEPLOY.md`), confirm every panel shows LIVE/DELAYED/EOD (not DEMO) with real upstreams. Fix any provider whose real response differs from the test fixtures.
2. **Create the Kuartal ID OAuth client** for the terminal and set `KUARTAL_ID_CLIENT_ID/SECRET`. Test login, logout, Free vs Pro gating with two test accounts.
3. **Run the desktop build** (Actions → Desktop app) and smoke-test the installers on Windows and macOS.
4. **Uptime check** — free UptimeRobot/Better Stack monitor on `/api/health`.

## P1 — Make it unmistakably Kuartal (free data)
5. **Server-side saved workspaces** for logged-in users (sync layouts between web, desktop and phone). Needs a small SQLite file on the server.
6. **Bahasa Indonesia UI toggle** (all labels in a dictionary; English default).
7. **Mobile: route "open panel" actions** to the More tab instead of the hidden desktop workspace.
8. **Alerts**: price/percent alerts on watchlist symbols → browser notifications (and Telegram bot later, free).
9. **Economic & policy calendar** (hand-curated JSON for BI, Fed, ECB, BPS release dates) + countdowns in the Pulse panel.
10. **IDX company profile panel** (from IDX/KSEI public disclosures where terms allow) — sector, shareholders summary, dividends.
11. **ASEAN equities board** — expand Overview with sector ETFs and ASEAN country ETFs (all on the existing free feed).
12. **Pulse history** — store one Pulse score per day (SQLite) and chart it; backtest how regimes lined up with IHSG.
13. **Screener (Pro)** across LQ45/IDX80 using computed metrics (momentum, volatility, 52-week range, RSI) — no paid fundamentals.
14. **Portfolio tracker (Pro)** — manual holdings in IDR, P/L vs IHSG, allocation; private per user.
15. **Shareable panel snapshots** (PNG/link) for social posts with the Kuartal watermark.

## P2 — Ask Kuartal AI (self-hosted, Rp0)
16. Implement `/api/ai/ask` against Ollama on the Kuartal AI home server (`docs/AI.md`): intent → validated actions.
17. "Explain this panel" summaries and a generated **morning brief** (cached once per day).
18. Bahasa-first prompts and evaluation set (a list of 100 real user questions with expected actions, run in CI).

## P3 — Ecosystem integration
19. **Kuartal ID membership upsell** inside the terminal (link to kuartal.id/membership; self-serve checkout when kuartal.id supports it).
20. **Hooks for future Kuartal apps**: deep links from the terminal into Kuartal Data (regional/geospatial), the Securities Crowdfunding dashboard and the business marketplace — the terminal stays market-only.
21. **Public embed widgets** (ticker tape, Pulse gauge) for kuartal.id and partner sites.

## Needs money or permission (do not build until approved)
- **Licensed equity data** (to replace the unofficial Yahoo endpoint before charging for IDX/US equity data) — e.g. an IDX data vendor or EOD Historical Data.
- **IDX foreign flow / broker summary / auction data** — needs an IDX data licence.
- **Nickel, CPO, coal (Newcastle) benchmark prices** — LME/ICE/Bursa data is licensed.
- **Code-signing**: Apple Developer (US$99/yr) + Windows certificate for warning-free desktop installers.
- **OJK review** if any feature drifts toward signals/recommendations.

## Technical debt to watch
- Web bundle is ~560 KB (175 KB gzipped). Lazy-load heavy panels (charts) when adding many more.
- In-memory cache/rate limiter assume a single server process; move to Redis if scaling out.
- LQ45 constituents are a hard-coded list (`shared/instruments.ts`) — update every Feb/Aug or fetch from IDX.
