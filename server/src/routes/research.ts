import { Hono, type Context } from 'hono';
import type { DataSource, Envelope } from '../../../shared/types';
import type { SourceStatus } from '../../../shared/research';
import { cache } from '../cache';
import { config } from '../config';
import { fetchText } from '../http';
import { COT_MARKETS, fetchCot, fetchFundamentals, fetchPredictionMarkets, PM_TOPICS } from '../providers/feeds';
import { getMacroTopic, TOPICS } from '../services/macroUs';
import {
  BREADTH_UNIVERSES,
  getBreadth,
  getComparison,
  getFxStrength,
  getPortfolioSim,
  getRatio,
  getRegression,
  getRotation,
  getStats,
  getTechnicals,
  getTermStructure,
  getVolatility,
  ROTATION_UNIVERSES,
} from '../services/research';

/**
 * /api/research/* — analytics and official-data panels. Mounted in index.ts.
 * Every response is an Envelope with an honest `source` label. Official feeds
 * (CFTC, SEC, Polymarket) never fall back to invented numbers: if the source
 * is down the panel shows that it's unavailable.
 */

export const research = new Hono();

const bad = (c: Context, error: string) => c.json({ error, code: 'bad_request' }, 400);
const unavailable = (c: Context, what: string, e: unknown) => c.json({ error: `${what} is unavailable right now (${(e as Error).message}). Please try again later.`, code: 'upstream' }, 502);
const sym = (v: string | undefined) => (v ?? '').trim().slice(0, 24);
const rangeOf = (v: string | undefined): '1Y' | '5Y' | null => {
  const r = (v ?? '1Y').toUpperCase();
  return r === '1Y' || r === '5Y' ? r : null;
};
const list = (v: string | undefined, max: number) => (v ?? '').split(',').map((s) => s.trim().slice(0, 24)).filter(Boolean).slice(0, max);
const wrap = <T,>(data: T, source: DataSource, provider: string): Envelope<T> => ({ data, source, provider, asOf: new Date().toISOString() });

// ── Price-history analytics ──────────────────────────────────────
research.get('/technicals', async (c) => {
  const s = sym(c.req.query('symbol'));
  if (!s) return bad(c, 'symbol is required');
  return c.json(await getTechnicals(s));
});

research.get('/stats', async (c) => {
  const s = sym(c.req.query('symbol'));
  const range = rangeOf(c.req.query('range'));
  if (!s || !range) return bad(c, 'symbol and range (1Y|5Y) are required');
  return c.json(await getStats(s, range));
});

research.get('/regression', async (c) => {
  const y = sym(c.req.query('y'));
  const x = sym(c.req.query('x'));
  const range = rangeOf(c.req.query('range'));
  if (!y || !x || !range) return bad(c, 'y, x and range are required');
  return c.json(await getRegression(y, x, range));
});

research.get('/ratio', async (c) => {
  const a = sym(c.req.query('a'));
  const b = sym(c.req.query('b'));
  const range = rangeOf(c.req.query('range'));
  if (!a || !b || !range) return bad(c, 'a, b and range are required');
  return c.json(await getRatio(a, b, range));
});

research.get('/compare', async (c) => {
  const symbols = list(c.req.query('symbols'), 8);
  const range = rangeOf(c.req.query('range'));
  if (symbols.length < 1 || !range) return bad(c, 'symbols and range are required');
  return c.json(await getComparison(symbols, range));
});

research.get('/fx-strength', async (c) => c.json(await getFxStrength()));

research.get('/rotation', async (c) => {
  const u = c.req.query('universe') ?? 'us-sectors';
  if (!(u in ROTATION_UNIVERSES)) return bad(c, `universe must be one of ${Object.keys(ROTATION_UNIVERSES).join(', ')}`);
  return c.json(await getRotation(u));
});

research.get('/breadth', async (c) => {
  const u = c.req.query('universe') ?? 'lq45';
  if (!(u in BREADTH_UNIVERSES)) return bad(c, `universe must be one of ${Object.keys(BREADTH_UNIVERSES).join(', ')}`);
  return c.json(await getBreadth(u));
});

research.get('/volatility', async (c) => c.json(await getVolatility()));
research.get('/term-structure', async (c) => c.json(await getTermStructure()));

research.get('/portfolio', async (c) => {
  const symbols = list(c.req.query('symbols'), 10);
  const weights = list(c.req.query('weights'), 10).map(Number);
  const range = rangeOf(c.req.query('range'));
  const rebalance = (c.req.query('rebalance') ?? 'monthly') as 'none' | 'monthly' | 'quarterly';
  const capital = Number(c.req.query('capital') ?? 100_000_000);
  const benchmark = sym(c.req.query('benchmark')) || '^JKSE';
  if (!symbols.length || symbols.length !== weights.length || weights.some((w) => !isFinite(w) || w < 0) || !range) return bad(c, 'symbols and weights (same count, ≥0) and range are required');
  if (!['none', 'monthly', 'quarterly'].includes(rebalance)) return bad(c, 'rebalance must be none, monthly or quarterly');
  if (!isFinite(capital) || capital <= 0 || capital > 1e15) return bad(c, 'capital must be a positive number');
  return c.json(await getPortfolioSim(symbols, weights, range, rebalance, capital, benchmark));
});

// ── US macro (FRED) ──────────────────────────────────────────────
research.get('/macro/:topic', async (c) => {
  const topic = c.req.param('topic');
  if (!(topic in TOPICS)) return bad(c, `topic must be one of ${Object.keys(TOPICS).join(', ')}`);
  return c.json(await getMacroTopic(topic));
});

// ── Official / public feeds ──────────────────────────────────────
research.get('/cot', async (c) => {
  try {
    const rows = await cache.get('cot', 6 * 3600_000, fetchCot);
    return c.json(wrap(rows, 'eod', 'CFTC Commitments of Traders (legacy, futures only) — public domain'));
  } catch (e) {
    return unavailable(c, 'CFTC data', e);
  }
});

research.get('/fundamentals', async (c) => {
  const t = sym(c.req.query('ticker')).toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(t)) return bad(c, 'ticker must be a US ticker like AAPL');
  if (t.endsWith('.JK')) return bad(c, 'IDX fundamentals are not available from a free licensed source yet — US SEC filers only for now.');
  try {
    const f = await cache.get(`sec:${t}`, 12 * 3600_000, () => fetchFundamentals(t));
    return c.json(wrap(f, 'eod', 'SEC EDGAR XBRL company facts (10-K annual filings) — public domain'));
  } catch (e) {
    return unavailable(c, `SEC filings for ${t}`, e);
  }
});

research.get('/predictions', async (c) => {
  const topic = c.req.query('topic') ?? 'economy';
  if (!(topic in PM_TOPICS)) return bad(c, `topic must be one of ${Object.keys(PM_TOPICS).join(', ')}`);
  try {
    const m = await cache.get(`pm:${topic}`, 10 * 60_000, () => fetchPredictionMarkets(topic));
    return c.json(wrap(m, 'delayed', 'Polymarket public market data (crowd-implied probabilities)'));
  } catch (e) {
    return unavailable(c, 'Prediction-market data', e);
  }
});

research.get('/meta', (c) =>
  c.json({ macroTopics: Object.fromEntries(Object.entries(TOPICS).map(([k, v]) => [k, v.title])), rotation: Object.keys(ROTATION_UNIVERSES), breadth: Object.fromEntries(Object.entries(BREADTH_UNIVERSES).map(([k, v]) => [k, v.name])), cot: COT_MARKETS, predictionTopics: PM_TOPICS }),
);

// ── Source status: which free upstreams answer from this server ──
const PROBES: { name: string; url: string; headers?: Record<string, string> }[] = [
  { name: 'Yahoo Finance (prices)', url: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EJKSE?range=5d&interval=1d' },
  { name: 'Binance (crypto)', url: 'https://data-api.binance.vision/api/v3/ping' },
  { name: 'US Treasury (yield curve)', url: 'https://home.treasury.gov/' },
  { name: 'FRED (US macro)', url: 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF&cosd=2026-01-01' },
  { name: 'World Bank (macro)', url: 'https://api.worldbank.org/v2/country/IDN?format=json' },
  { name: 'CFTC (COT report)', url: 'https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=1' },
  { name: 'SEC EDGAR (fundamentals)', url: 'https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/dei/EntityCommonStockSharesOutstanding.json', headers: { 'User-Agent': 'Kuartal Terminal research hello@kuartal.id' } },
  { name: 'Polymarket (prediction markets)', url: 'https://gamma-api.polymarket.com/events?limit=1' },
  { name: 'Frankfurter (FX reference)', url: 'https://api.frankfurter.dev/v1/latest' },
];

research.get('/sources-status', async (c) => {
  const rows = await cache.get('src-status', 5 * 60_000, async () =>
    Promise.all(
      PROBES.map(async (p): Promise<SourceStatus> => {
        const t0 = Date.now();
        try {
          await fetchText(p.url, { headers: p.headers, timeoutMs: 8000 });
          return { name: p.name, ok: true, ms: Date.now() - t0 };
        } catch (e) {
          return { name: p.name, ok: false, ms: Date.now() - t0, detail: (e as Error).message };
        }
      }),
    ),
  );
  return c.json({ dataMode: config.dataMode, checkedAt: new Date().toISOString(), sources: rows });
});
