# Kuartal Terminal

**Markets, macro and news in one workspace — built for Indonesia.**
A free, Bloomberg-style terminal for Kuartal ID members, with Pro panels for paid
members. Lives at **https://terminal.kuartalsystems.com**.

> 🤖 **AI agents (Claude, Codex, Gemini) and contributors: read [`AGENTS.md`](AGENTS.md) first.**

## What's inside (v0.1.0)

| Code | Panel | Notes |
|---|---|---|
| `PLS` | **Kuartal Pulse** | Transparent risk-appetite score with an **Indonesia lens** (IHSG, rupiah, coal, oil). Methodology shown in-app |
| `OVR` | Market Overview | Indonesia, Asia, US/EU, FX, commodities, rates, crypto |
| `CHT` | Chart | Candles, volume, EMA20/SMA50/SMA200, RSI, 1D→MAX, linked to clicks anywhere |
| `WL` | Watchlist | Saved in your browser, sparklines |
| `NWS` | News | Indonesian + global public feeds, search, region/topic filters |
| `IDX` | IDX Movers | LQ45 table + heatmap, sector baskets (banks, coal, nickel, telco…) |
| `FX` | FX Board | Rupiah & majors (ECB reference), strength vs USD |
| `CLK` | Market Hours | IDX, SGX, Bursa, SET, TSE, HKEX, SSE, XETRA, LSE, NYSE in your time zone |
| `YC` | US Yield Curve | Treasury curve vs 1M/1Y ago, 2s10s & 3m10y |
| `MAC` | Macro Compare | World Bank indicators across ASEAN + majors |
| `CRY` | Crypto Live | Streaming prices (browser ↔ Binance websocket) |
| `BOOK` | Order Book | Live depth ladder + imbalance |
| `COR` | Correlation **(Pro)** | Rolling correlation matrix, any symbols |
| `SEA` | Seasonality **(Pro)** | 15-year monthly return grid, averages, hit-rates |
| `ASK` | Ask Kuartal | Plain-language assistant (EN/ID) that drives the terminal. AI model plugs in later |
| `CAL` | Calculators | IDX lots/fees/break-even with tick sizes, position sizing, compounding |
| `HELP` | Terminal Guide | Commands, panels, data labels |

Plus: Bloomberg-style command bar (`/` or `Ctrl K`: `BBCA`, `GOLD SEA`, `BTC BOOK`,
`NWS rupiah`, or a sentence), tabbed workspaces with drag/resize, ticker tape, WIB/WITA
clocks, light/dark themes, **Log in with Kuartal ID**, a phone layout with bottom tabs,
installable PWA, and a desktop app.

Every panel shows where its data comes from: **LIVE · DELAYED · EOD · ANNUAL · DEMO**.

## Run it

```sh
npm install
npm run dev                  # http://localhost:5173 (API on :8787)
DATA_MODE=demo npm run dev   # offline
npm run check                # typecheck + tests + build + guardrails
```

Production: see [`docs/DEPLOY.md`](docs/DEPLOY.md) (Docker + Cloudflare Tunnel on the home server).

## Docs
- [`AGENTS.md`](AGENTS.md) — rules for AI agents and contributors
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — what was done last and what's next
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — prioritised expansion list
- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md) — every source, its cost and terms
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — hosting, Kuartal ID login, updates, rollback
- [`docs/AI.md`](docs/AI.md) — Ask Kuartal and how to plug in a self-hosted model
- [`desktop/README.md`](desktop/README.md) — desktop installers

## Stack
React 19 + Vite 8 · react-grid-layout · lightweight-charts (TradingView, Apache-2.0) ·
Zustand · Hono on Node 22 · jose (OIDC) · Vitest · Tauri 2 (desktop) · Docker.

---
Kuartal Terminal is a research tool by PT Kuartal Financial Group. **Not investment advice.**
Data comes from public sources and may be delayed or incomplete.
