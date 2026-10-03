# Data sources

Owner rule: **everything must be free to use and free to run.** No paid feeds,
no paid APIs. Every response is labelled with its `source` so users always know
what they're looking at.

| Source | Used for | Cost / key | Terms | Label |
|---|---|---|---|---|
| Yahoo Finance chart API (`query1/2.finance.yahoo.com/v8/finance/chart`) | IDX stocks, indices, FX, futures, Treasury yield indices, history | Free, no key | **Unofficial.** No redistribution licence. OK for a free community tool; replace before monetising equity data | `delayed` |
| Binance public market data (`data-api.binance.vision`, websocket `data-stream.binance.vision`) | Crypto quotes, candles, live ticker & order book | Free, no key | Public market data | `live` |
| U.S. Department of the Treasury — daily par yield curve CSV | US yield curve | Free | US government work, public domain | `eod` |
| Frankfurter (`api.frankfurter.dev`) — ECB euro reference rates | FX board | Free, no key | Open; ECB reference rates | `eod` |
| World Bank Open Data API | Macro indicators by country | Free, no key | CC BY 4.0 — attribution shown in the panel | `static` |
| Public RSS feeds (CNBC Indonesia, Antara, Tempo, CNBC, MarketWatch, Federal Reserve, ECB, CoinDesk) | News headlines | Free | We show **headline + link + source only**, never article text | `live` |
| `providers/demo.ts` | Fallback when a source is unreachable | — | Synthetic, deterministic | `demo` (amber badge) |

Charts use TradingView **lightweight-charts** (Apache-2.0). Its licence requires the
small TradingView attribution logo on charts — keep `attributionLogo: true`.

## Rate limits & politeness
- Server-side TTL cache: quotes 30 s, crypto 10 s, history 5 min, news 3 min, FX 30 min, yields 1 h, macro 12 h.
- In-flight de-duplication means 1,000 users looking at IHSG cause one upstream call.
- Max 6 concurrent Yahoo requests. Per-IP API rate limit: 2 req/s sustained, burst 120.
- Live crypto streams go browser → Binance directly (no load on our server).

## Known gaps (need a free source before building)
- **IDX foreign flow, broker summary, closing auction** — not available free with clear terms. IDX's own site has
  daily statistics but no open API; scraping it needs IDX's permission.
- **Nickel and CPO prices** (key Indonesian exports) — no reliable free feed found; LME/Bursa Malaysia data is licensed.
- **Bank Indonesia rate / SBN yields** — BI publishes on its website (no API). A small scheduled scraper with
  attribution could work; check BI's terms first.
- **Economic calendar** — no clean free source; Fed/ECB/BI calendars could be hand-maintained.

## Swapping a provider
All symbol routing is in `server/src/services/market.ts`. To replace Yahoo with a
licensed feed later, add `providers/<new>.ts` and change only `yahooQuote()` /
`getHistory()` there. The rest of the app doesn't care.
