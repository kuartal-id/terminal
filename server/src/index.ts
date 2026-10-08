import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono, type Context } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { ApiError } from '../../shared/types';
import { ALL_INSTRUMENTS, LQ45, MARKETS } from '../../shared/instruments';
import { callback, hasAccess, login, logout, me, readSession, tierFor } from './auth';
import { cache } from './cache';
import { authConfigured, config } from './config';
import { demoCurve, demoFx, demoMacro } from './providers/demo';
import { fxBoard, MACRO_COUNTRIES, MACRO_INDICATORS, treasuryCurve, worldBank } from './providers/official';
import { FEEDS } from './providers/rss';
import { getCorrelation, getSeasonality } from './services/analytics';
import { getHistory, getQuotes, HISTORY_RANGES } from './services/market';
import { getNews } from './services/news';
import { getPulse } from './services/pulse';
import { research } from './routes/research';

const VERSION = '0.1.0';
const started = Date.now();

export const app = new Hono();

const err = (c: Context, status: 400 | 401 | 402 | 403 | 404 | 429 | 502, code: ApiError['code'], error: string) => c.json<ApiError>({ error, code }, status);

// ── Security headers ─────────────────────────────────────────────
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// ── Simple per-IP rate limit for the API (protects free upstreams) ──
const buckets = new Map<string, { tokens: number; at: number }>();
app.use('/api/*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: 120, at: now };
  b.tokens = Math.min(120, b.tokens + ((now - b.at) / 1000) * 2); // 2 req/s sustained, burst 120
  b.at = now;
  if (b.tokens < 1) return err(c, 429, 'bad_request', 'Too many requests — slow down a little.');
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 20000) buckets.clear();
  await next();
});

// ── Access gate: Kuartal ID login + terminal.access ──────────────
// Everything under /api except health and /api/me needs a signed-in Kuartal ID
// session holding config.kuartalId.accessEntitlement (granted by an admin or
// by a paid membership in Kuartal ID). Turn off with REQUIRE_LOGIN=false.
const OPEN_API = new Set(['/api/health', '/api/me']);
app.use('/api/*', async (c, next) => {
  if (OPEN_API.has(c.req.path)) return next();
  const session = await readSession(c);
  if (hasAccess(session)) return next();
  if (!session) return err(c, 401, 'login_required', 'Log in with your Kuartal ID to use Kuartal Terminal.');
  return err(c, 403, 'access_required', 'Your Kuartal ID does not have Terminal Access yet.');
});

// ── Health / meta ────────────────────────────────────────────────
app.get('/api/health', (c) =>
  c.json({ ok: true, version: VERSION, uptimeSec: Math.round((Date.now() - started) / 1000), dataMode: config.dataMode, authConfigured: authConfigured(), cacheEntries: cache.size }),
);

app.get('/api/instruments', (c) => c.json({ markets: MARKETS, lq45: LQ45, count: ALL_INSTRUMENTS.length }));

app.get('/api/sources', (c) =>
  c.json({
    feeds: FEEDS.map((f) => ({ name: f.name, url: f.url, region: f.region })),
    providers: [
      { name: 'Yahoo Finance (unofficial chart API)', use: 'Indices, IDX & global equities, FX, futures', terms: 'Unofficial — replace before charging for this data' },
      { name: 'Binance public market data', use: 'Crypto prices, candles, order book (browser websocket)', terms: 'Free public market data' },
      { name: 'US Treasury', use: 'Yield curve', terms: 'US government public domain' },
      { name: 'Frankfurter / ECB', use: 'Reference FX rates', terms: 'Free, open' },
      { name: 'World Bank Open Data', use: 'Macro indicators', terms: 'CC BY 4.0' },
      { name: 'FRED (St. Louis Fed)', use: 'US macro dashboards — US-government-sourced series only', terms: 'Public domain series; third-party copyrighted FRED series are not used' },
      { name: 'CFTC Commitments of Traders', use: 'COT positioning', terms: 'US government public domain' },
      { name: 'SEC EDGAR XBRL', use: 'US company fundamentals', terms: 'US government public domain' },
      { name: 'Polymarket Gamma API', use: 'Crowd-implied event probabilities', terms: 'Public market data; shown as information only' },
    ],
  }),
);

// ── Auth (Kuartal ID) ────────────────────────────────────────────
app.get('/api/me', async (c) => c.json(await me(c)));
app.get('/auth/login', login);
app.get('/auth/callback', callback);
app.get('/auth/logout', logout);

// ── Market data (free tier) ──────────────────────────────────────
app.get('/api/quotes', async (c) => {
  const symbols = (c.req.query('symbols') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!symbols.length) return err(c, 400, 'bad_request', 'symbols is required');
  return c.json(await getQuotes(symbols));
});

app.get('/api/history', async (c) => {
  const symbol = c.req.query('symbol');
  const range = (c.req.query('range') ?? '1Y').toUpperCase();
  if (!symbol) return err(c, 400, 'bad_request', 'symbol is required');
  if (!HISTORY_RANGES.includes(range)) return err(c, 400, 'bad_request', `range must be one of ${HISTORY_RANGES.join(', ')}`);
  return c.json(await getHistory(symbol, range));
});

app.get('/api/news', async (c) =>
  c.json(await getNews({ region: c.req.query('region'), topic: c.req.query('topic'), q: c.req.query('q'), limit: Number(c.req.query('limit') ?? 150) })),
);

app.get('/api/pulse', async (c) => c.json(await getPulse()));

app.get('/api/fx', async (c) => {
  const data = await cache.get('fx', 30 * 60_000, async () => {
    try {
      return { data: await fxBoard('USD'), source: 'eod' as const, provider: 'Frankfurter (ECB reference rates)' };
    } catch {
      return { data: demoFx(), source: 'demo' as const, provider: 'Kuartal demo generator' };
    }
  });
  return c.json({ ...data, asOf: new Date().toISOString() });
});

app.get('/api/yields', async (c) => {
  const data = await cache.get('yields', 60 * 60_000, async () => {
    try {
      return { data: await treasuryCurve(), source: 'eod' as const, provider: 'U.S. Department of the Treasury' };
    } catch {
      return { data: demoCurve(), source: 'demo' as const, provider: 'Kuartal demo generator' };
    }
  });
  return c.json({ ...data, asOf: new Date().toISOString() });
});

app.get('/api/macro/meta', (c) => c.json({ indicators: MACRO_INDICATORS, countries: MACRO_COUNTRIES }));

app.get('/api/macro', async (c) => {
  const indicator = c.req.query('indicator') ?? 'NY.GDP.MKTP.KD.ZG';
  if (!(indicator in MACRO_INDICATORS)) return err(c, 400, 'bad_request', 'unknown indicator');
  const countries = (c.req.query('countries') ?? 'IDN,MYS,THA,PHL,VNM').split(',').map((s) => s.trim().toUpperCase()).filter((s) => s in MACRO_COUNTRIES).slice(0, 8);
  if (!countries.length) return err(c, 400, 'bad_request', 'no valid countries');
  const to = new Date().getFullYear();
  const from = to - 20;
  const data = await cache.get(`wb:${indicator}:${countries.join(',')}`, 12 * 3600_000, async () => {
    try {
      return { data: await worldBank(indicator, countries, from, to), source: 'static' as const, provider: 'World Bank Open Data (CC BY 4.0)' };
    } catch {
      return { data: demoMacro(indicator, countries, from, to), source: 'demo' as const, provider: 'Kuartal demo generator' };
    }
  });
  return c.json({ ...data, asOf: new Date().toISOString() });
});

// ── Research panels (technicals, US macro, CFTC/SEC/Polymarket) ──
app.route('/api/research', research);

// ── Ask Kuartal AI (placeholder) ─────────────────────────────────
// The browser already runs a free rule-based assistant. When a self-hosted
// model is ready (see docs/AI.md), implement it here and return a `Reply`
// ({ text, actions[], suggestions? }). Until then: 501 → client falls back.
app.post('/api/ai/ask', (c) => c.json({ error: 'AI model not configured yet — using the built-in rules assistant.', code: 'not_configured' }, 501));

// ── PRO (requires Kuartal ID entitlement) ────────────────────────
app.use('/api/pro/*', async (c, next) => {
  const session = await readSession(c);
  const tier = tierFor(session);
  if (tier === 'pro') return next();
  if (tier === 'guest') return err(c, 401, 'login_required', 'Log in with Kuartal ID to use this panel.');
  return err(c, 402, 'premium_required', 'This panel is part of Kuartal Pro.');
});

app.get('/api/pro/correlation', async (c) => {
  const symbols = (c.req.query('symbols') ?? '^JKSE,IDR=X,^GSPC,GC=F,BZ=F,MTF=F,BTCUSDT,^TNX').split(',').filter(Boolean);
  const window = Math.min(250, Math.max(20, Number(c.req.query('window') ?? 60)));
  if (symbols.length < 2) return err(c, 400, 'bad_request', 'need at least 2 symbols');
  return c.json(await getCorrelation(symbols, window));
});

app.get('/api/pro/seasonality', async (c) => {
  const symbol = c.req.query('symbol') ?? '^JKSE';
  return c.json(await getSeasonality(symbol));
});

app.notFound((c) => (c.req.path.startsWith('/api/') ? err(c, 404, 'not_found', 'No such endpoint') : c.text('Not found', 404)));
app.onError((e, c) => {
  console.error('[error]', c.req.method, c.req.path, e.message);
  return c.req.path.startsWith('/api/') ? err(c, 502, 'upstream', 'A data source failed. Please retry shortly.') : c.text('Server error', 500);
});

// ── Static web app (built by `npm run build -w web`) ─────────────
const staticRoot = relative(process.cwd(), config.staticDir) || '.';
if (existsSync(join(config.staticDir, 'index.html'))) {
  app.use('/assets/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  });
  app.use('/*', serveStatic({ root: staticRoot }));
  const indexHtml = readFileSync(join(config.staticDir, 'index.html'), 'utf8');
  // SPA fallback for client routes only — API/auth misses must stay JSON 404s.
  app.get('*', (c, next) => (c.req.path.startsWith('/api/') || c.req.path.startsWith('/auth/') ? next() : c.html(indexHtml)));
}

if (process.env.VITEST === undefined) {
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`Kuartal Terminal API v${VERSION} on :${info.port} · data=${config.dataMode} · auth=${authConfigured() ? 'Kuartal ID' : 'NOT CONFIGURED'} · login ${config.requireLogin ? 'required' : 'optional'}${config.devGrantPro ? ' · DEV_GRANT_PRO' : ''}`);
  });
}
