import type { Candle, DataSource, Envelope } from '../../../shared/types';
import type {
  BreadthStats,
  ComparisonResponse,
  PortfolioResult,
  RatioStats,
  RegressionStats,
  RotationRow,
  SeriesStats,
  TechnicalsResponse,
  TermCurve,
  Timeframe,
  TimeframeAnalysis,
  VolRow,
} from '../../../shared/research';
import { isCrypto, LQ45, resolveInstrument } from '../../../shared/instruments';
import { cache, mapLimit } from '../cache';
import { binanceKlines } from '../providers/binance';
import { demoCandles } from '../providers/demo';
import { yahooChart } from '../providers/yahoo';
import { getHistory, getQuotes, worstSource } from './market';
import {
  aggregateCandles,
  alignDaily,
  breadth,
  fxStrength,
  indicatorSummary,
  meanReversionRead,
  percentileOfLast,
  ratioStats,
  regression,
  rrg,
  seriesStats,
  simulatePortfolio,
  structureRead,
  supportResistance,
  trendRead,
} from './ta';

/** Research analytics computed from free price history (Yahoo, Binance). Descriptive only. */

const now = () => new Date().toISOString();
const providerFor = (sources: DataSource[]) => {
  const s = worstSource(sources);
  return { source: s, provider: s === 'demo' ? 'Kuartal analytics on demo prices (upstream unreachable)' : 'Kuartal analytics · Yahoo Finance (unofficial) / Binance' };
};

// ───────────── Multi-timeframe candles ─────────────

const TF_SPEC: Record<Timeframe, { yahoo: [string, string]; group: number; binance: string; step: number }> = {
  '1D': { yahoo: ['2y', '1d'], group: 1, binance: '1d', step: 86400 },
  '4H': { yahoo: ['60d', '60m'], group: 4, binance: '4h', step: 14400 },
  '15M': { yahoo: ['10d', '15m'], group: 1, binance: '15m', step: 900 },
};

export async function getCandles(symbol: string, tf: Timeframe): Promise<{ candles: Candle[]; source: DataSource }> {
  const spec = TF_SPEC[tf];
  return cache.get(`tf:${symbol}:${tf}`, tf === '1D' ? 10 * 60_000 : 3 * 60_000, async () => {
    try {
      if (isCrypto(symbol)) return { candles: await binanceKlines(symbol, spec.binance, 400), source: 'live' as DataSource };
      const ch = await yahooChart(symbol, spec.yahoo[0], spec.yahoo[1]);
      const c = aggregateCandles(ch.candles.filter((x) => isFinite(x.close) && x.close > 0), spec.group);
      if (c.length < 30) throw new Error('too few bars');
      return { candles: c, source: 'delayed' as DataSource };
    } catch {
      return { candles: demoCandles(symbol, 300, spec.step), source: "demo" as DataSource };
    }
  });
}

function analyse(tf: Timeframe, candles: Candle[]): TimeframeAnalysis {
  return {
    tf,
    bars: candles.length,
    price: candles[candles.length - 1].close,
    indicators: indicatorSummary(candles),
    trend: trendRead(candles),
    meanReversion: meanReversionRead(candles),
    levels: supportResistance(candles),
    structure: structureRead(candles),
    closes: candles.slice(-120).map((c) => c.close),
  };
}

export async function getTechnicals(raw: string): Promise<Envelope<TechnicalsResponse>> {
  const inst = resolveInstrument(raw);
  if (!inst) throw new Error('unknown symbol');
  const tfs: Timeframe[] = ['1D', '4H', '15M'];
  const loaded = await Promise.all(tfs.map((tf) => getCandles(inst.symbol, tf)));
  return {
    data: { symbol: inst.symbol, label: inst.label, frames: tfs.map((tf, i) => analyse(tf, loaded[i].candles)) },
    ...providerFor(loaded.map((l) => l.source)),
    asOf: now(),
  };
}

// ───────────── Daily series helpers ─────────────

async function daily(symbol: string, range: '1Y' | '5Y' = '1Y') {
  const h = await getHistory(symbol, range);
  return { times: h.data.candles.map((c) => c.time), closes: h.data.candles.map((c) => c.close), source: h.source, label: h.data.label };
}

export async function getStats(symbol: string, range: '1Y' | '5Y'): Promise<Envelope<SeriesStats & { label: string; closes: number[] }>> {
  const d = await daily(symbol, range);
  const s = seriesStats(d.closes, range === '5Y' ? 52 : 252);
  return { data: { ...s, label: d.label, closes: d.closes }, ...providerFor([d.source]), asOf: now() };
}

export async function getRegression(y: string, x: string, range: '1Y' | '5Y'): Promise<Envelope<RegressionStats & { yLabel: string; xLabel: string }>> {
  const [a, b] = await Promise.all([daily(y, range), daily(x, range)]);
  const al = alignDaily([a, b]);
  if (al.days.length < 20) throw new Error('not enough overlapping data');
  return { data: { ...regression(al.closes[0], al.closes[1], range === '5Y' ? 52 : 252), yLabel: a.label, xLabel: b.label }, ...providerFor([a.source, b.source]), asOf: now() };
}

export async function getRatio(a: string, b: string, range: '1Y' | '5Y'): Promise<Envelope<RatioStats & { aLabel: string; bLabel: string; times: number[] }>> {
  const [x, y] = await Promise.all([daily(a, range), daily(b, range)]);
  const al = alignDaily([x, y]);
  if (al.days.length < 20) throw new Error('not enough overlapping data');
  return { data: { ...ratioStats(al.closes[0], al.closes[1]), aLabel: x.label, bLabel: y.label, times: al.days.map((d) => d * 86400) }, ...providerFor([x.source, y.source]), asOf: now() };
}

export async function getComparison(symbols: string[], range: '1Y' | '5Y'): Promise<Envelope<ComparisonResponse>> {
  const series = await mapLimit(symbols.slice(0, 8), 4, (s) => daily(s, range));
  const al = alignDaily(series);
  return {
    data: {
      times: al.days.map((d) => d * 86400),
      lines: series.map((s, i) => {
        const c = al.closes[i];
        const values = c.map((v) => Number(((v / c[0]) * 100).toFixed(2)));
        return { symbol: symbols[i], label: s.label, values, changePct: values.length ? Number((values[values.length - 1] - 100).toFixed(2)) : 0 };
      }),
    },
    ...providerFor(series.map((s) => s.source)),
    asOf: now(),
  };
}

// ───────────── FX strength ─────────────

/** Yahoo FX symbols and whether the quote is USD per unit (true) or units per USD (false). */
export const FX_BASKET: { ccy: string; symbol: string; usdPerUnit: boolean }[] = [
  { ccy: 'EUR', symbol: 'EURUSD=X', usdPerUnit: true },
  { ccy: 'GBP', symbol: 'GBPUSD=X', usdPerUnit: true },
  { ccy: 'AUD', symbol: 'AUDUSD=X', usdPerUnit: true },
  { ccy: 'NZD', symbol: 'NZDUSD=X', usdPerUnit: true },
  { ccy: 'JPY', symbol: 'JPY=X', usdPerUnit: false },
  { ccy: 'CAD', symbol: 'CAD=X', usdPerUnit: false },
  { ccy: 'CHF', symbol: 'CHF=X', usdPerUnit: false },
  { ccy: 'CNY', symbol: 'CNY=X', usdPerUnit: false },
  { ccy: 'SGD', symbol: 'SGD=X', usdPerUnit: false },
  { ccy: 'IDR', symbol: 'IDR=X', usdPerUnit: false },
  { ccy: 'MYR', symbol: 'MYR=X', usdPerUnit: false },
];

export async function getFxStrength(): Promise<Envelope<{ windows: { label: string; bars: number; rows: { ccy: string; strength: number; returnPct: number }[] }[] }>> {
  const series = await mapLimit(FX_BASKET, 4, (f) => daily(f.symbol, '1Y'));
  const usd: Record<string, number[]> = {};
  FX_BASKET.forEach((f, i) => (usd[f.ccy] = series[i].closes.map((v) => (f.usdPerUnit ? v : 1 / v))));
  const windows = [
    { label: '1D', bars: 1 },
    { label: '1W', bars: 5 },
    { label: '1M', bars: 21 },
    { label: '3M', bars: 63 },
  ].map((w) => ({ ...w, rows: fxStrength(usd, w.bars) }));
  return { data: { windows }, ...providerFor(series.map((s) => s.source)), asOf: now() };
}

// ───────────── Rotation ─────────────

export const ROTATION_UNIVERSES: Record<string, { benchmark: string; members: [string, string][] }> = {
  'us-sectors': {
    benchmark: 'SPY',
    members: [['XLK', 'Technology'], ['XLF', 'Financials'], ['XLE', 'Energy'], ['XLV', 'Health Care'], ['XLI', 'Industrials'], ['XLY', 'Cons. Discretionary'], ['XLP', 'Cons. Staples'], ['XLU', 'Utilities'], ['XLB', 'Materials'], ['XLRE', 'Real Estate'], ['XLC', 'Communication']],
  },
  themes: {
    benchmark: 'SPY',
    members: [['SMH', 'Semiconductors'], ['IGV', 'Software'], ['ITA', 'Aerospace & Defense'], ['URA', 'Uranium'], ['TAN', 'Solar'], ['GDX', 'Gold Miners'], ['XBI', 'Biotech'], ['KWEB', 'China Internet'], ['ARKK', 'Disruptive Innovation'], ['PAVE', 'Infrastructure']],
  },
  countries: {
    benchmark: 'ACWI',
    members: [['EIDO', 'Indonesia'], ['EWS', 'Singapore'], ['EWM', 'Malaysia'], ['THD', 'Thailand'], ['EPHE', 'Philippines'], ['VNM', 'Vietnam'], ['INDA', 'India'], ['MCHI', 'China'], ['EWJ', 'Japan'], ['EWY', 'South Korea'], ['SPY', 'United States'], ['EWZ', 'Brazil']],
  },
};

export async function getRotation(universe: string): Promise<Envelope<{ universe: string; benchmark: string; rows: RotationRow[] }>> {
  const u = ROTATION_UNIVERSES[universe];
  if (!u) throw new Error('unknown universe');
  return cache.get(`rot:${universe}`, 30 * 60_000, async () => {
    const [bench, ...members] = await mapLimit([u.benchmark, ...u.members.map((m) => m[0])], 4, (s) => daily(s, '1Y'));
    const rows: RotationRow[] = members.map((m, i) => {
      const al = alignDaily([m, bench]);
      const c = al.closes[0];
      const chg = (n: number) => (c.length > n ? Number(((c[c.length - 1] / c[c.length - 1 - n] - 1) * 100).toFixed(2)) : null);
      return { symbol: u.members[i][0], label: u.members[i][1], tail: rrg(al.closes[0], al.closes[1]), change1mPct: chg(21), change3mPct: chg(63) };
    });
    return { data: { universe, benchmark: u.benchmark, rows }, ...providerFor([bench.source, ...members.map((m) => m.source)]), asOf: now() };
  });
}

// ───────────── Breadth ─────────────

const DOW30 = ['AAPL', 'AMGN', 'AMZN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS', 'GS', 'HD', 'HON', 'IBM', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK', 'MSFT', 'NKE', 'NVDA', 'PG', 'SHW', 'TRV', 'UNH', 'V', 'VZ', 'WMT'];

export const BREADTH_UNIVERSES: Record<string, { name: string; index: string; symbols: () => string[] }> = {
  lq45: { name: 'LQ45 (IDX)', index: '^JKLQ45', symbols: () => LQ45.map((i) => i.symbol) },
  dow30: { name: 'Dow Jones 30', index: '^DJI', symbols: () => DOW30 },
};

export async function getBreadth(universe: string): Promise<Envelope<BreadthStats & { name: string; leaders: { symbol: string; changePct: number }[]; laggards: { symbol: string; changePct: number }[] }>> {
  const u = BREADTH_UNIVERSES[universe];
  if (!u) throw new Error('unknown universe');
  return cache.get(`brd:${universe}`, 30 * 60_000, async () => {
    const syms = u.symbols();
    const series = await mapLimit(syms, 6, (s) => daily(s, '1Y'));
    const closes = series.map((s) => s.closes);
    const day = syms
      .map((s, i) => {
        const c = closes[i];
        return { symbol: s.replace(/\.JK$/, ''), changePct: c.length > 1 ? Number(((c[c.length - 1] / c[c.length - 2] - 1) * 100).toFixed(2)) : 0 };
      })
      .sort((a, b) => b.changePct - a.changePct);
    return { data: { ...breadth(closes), name: u.name, leaders: day.slice(0, 5), laggards: day.slice(-5).reverse() }, ...providerFor(series.map((s) => s.source)), asOf: now() };
  });
}

// ───────────── Volatility ─────────────

export const VOL_INDICES: [string, string][] = [
  ['^VIX', 'VIX · S&P 500 30-day implied'],
  ['^VIX9D', 'VIX 9-day'],
  ['^VIX3M', 'VIX 3-month'],
  ['^VIX6M', 'VIX 6-month'],
  ['^VXN', 'VXN · Nasdaq-100'],
  ['^RVX', 'RVX · Russell 2000'],
  ['^MOVE', 'MOVE · Treasury options'],
  ['^OVX', 'OVX · Crude oil'],
  ['^GVZ', 'GVZ · Gold'],
];
export const REALISED_VOL: [string, string][] = [
  ['^JKSE', 'IHSG realised (20D)'],
  ['IDR=X', 'USD/IDR realised (20D)'],
  ['BTCUSDT', 'Bitcoin realised (20D)'],
];

/** Annualised 20-day realised volatility series from closes. Pure. */
export function realisedVolSeries(closes: number[], window = 20, perYear = 252): number[] {
  const r = closes.slice(1).map((v, i) => Math.log(v / closes[i]));
  const out: number[] = [];
  for (let i = window; i <= r.length; i++) {
    const w = r.slice(i - window, i);
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    out.push(Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / (w.length - 1)) * Math.sqrt(perYear) * 100);
  }
  return out;
}

export async function getVolatility(): Promise<Envelope<{ rows: VolRow[]; vixTerm: { label: string; value: number }[] }>> {
  return cache.get('vol', 10 * 60_000, async () => {
    const idx = await mapLimit(VOL_INDICES, 4, async ([s, label]) => {
      const d = await daily(s, '1Y');
      const c = d.closes;
      return { row: { symbol: s, label, level: c.length ? Number(c[c.length - 1].toFixed(2)) : null, change1dPct: c.length > 1 ? Number(((c[c.length - 1] / c[c.length - 2] - 1) * 100).toFixed(2)) : null, percentile1y: c.length ? percentileOfLast(c) : null } as VolRow, source: d.source };
    });
    const real = await mapLimit(REALISED_VOL, 3, async ([s, label]) => {
      const d = await daily(s, '1Y');
      const v = realisedVolSeries(d.closes, 20, isCrypto(s) ? 365 : 252);
      return { row: { symbol: s, label, level: v.length ? Number(v[v.length - 1].toFixed(2)) : null, change1dPct: v.length > 1 ? Number((v[v.length - 1] - v[v.length - 2]).toFixed(2)) : null, percentile1y: v.length ? percentileOfLast(v) : null, realised: true } as VolRow, source: d.source };
    });
    const byS = new Map(idx.map((x) => [x.row.symbol, x.row.level]));
    const vixTerm = [['^VIX9D', '9D'], ['^VIX', '30D'], ['^VIX3M', '3M'], ['^VIX6M', '6M']].map(([s, label]) => ({ label, value: byS.get(s) ?? NaN })).filter((p) => isFinite(p.value));
    return { data: { rows: [...idx, ...real].map((x) => x.row), vixTerm }, ...providerFor([...idx, ...real].map((x) => x.source)), asOf: now() };
  });
}

// ───────────── Futures term structure ─────────────

const MONTH_CODES = 'FGHJKMNQUVXZ';
export const FUTURES_ROOTS: { root: string; name: string; exch: string; months: string }[] = [
  { root: 'CL', name: 'WTI crude oil', exch: 'NYM', months: 'FGHJKMNQUVXZ' },
  { root: 'NG', name: 'Natural gas', exch: 'NYM', months: 'FGHJKMNQUVXZ' },
  { root: 'GC', name: 'Gold', exch: 'CMX', months: 'GJMQVZ' },
  { root: 'HG', name: 'Copper', exch: 'CMX', months: 'HKNUZ' },
  { root: 'ZC', name: 'Corn', exch: 'CBT', months: 'HKNUZ' },
  { root: 'ZS', name: 'Soybeans', exch: 'CBT', months: 'FHKNQUX' },
  { root: 'ZW', name: 'Wheat', exch: 'CBT', months: 'HKNUZ' },
];

/** Next `count` listed contract symbols in Yahoo format, e.g. CLZ26.NYM. Pure. */
export function contractSymbols(root: string, exch: string, months: string, from: Date, count = 6): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth() + 1; // front month usually rolls before expiry; start next month
  while (out.length < count) {
    if (m > 11) {
      m = 0;
      y++;
    }
    const code = MONTH_CODES[m];
    if (months.includes(code)) out.push(`${root}${code}${String(y % 100).padStart(2, '0')}.${exch}`);
    m++;
  }
  return out;
}

/** Classify a curve by consecutive differences. Pure. */
export function curveShape(prices: number[]): { shape: TermCurve['shape']; spreadPct: number } {
  if (prices.length < 2) return { shape: 'flat', spreadPct: 0 };
  const spreadPct = Number(((prices[prices.length - 1] / prices[0] - 1) * 100).toFixed(2));
  const ups = prices.slice(1).filter((p, i) => p > prices[i]).length;
  const downs = prices.length - 1 - ups;
  if (Math.abs(spreadPct) < 0.5) return { shape: 'flat', spreadPct };
  if (ups >= downs * 2 && spreadPct > 0) return { shape: 'contango', spreadPct };
  if (downs >= ups * 2 && spreadPct < 0) return { shape: 'backwardation', spreadPct };
  return { shape: 'mixed', spreadPct };
}

export async function getTermStructure(): Promise<Envelope<{ curves: TermCurve[] }>> {
  return cache.get('fts', 15 * 60_000, async () => {
    const curves: TermCurve[] = [];
    const sources: DataSource[] = [];
    for (const r of FUTURES_ROOTS) {
      const syms = contractSymbols(r.root, r.exch, r.months, new Date(), 6);
      const q = await getQuotes(syms);
      const pts = q.data.filter((x) => x.source !== 'demo' && x.price > 0).map((x) => ({ symbol: x.symbol, label: x.symbol.slice(r.root.length, r.root.length + 3), price: x.price }));
      if (pts.length < 3) continue;
      sources.push(q.source);
      curves.push({ root: r.root, name: r.name, points: pts, ...curveShape(pts.map((p) => p.price)) });
    }
    if (!curves.length) return { data: { curves }, source: 'demo' as DataSource, provider: 'No futures contract prices reachable', asOf: now(), note: 'Futures contract prices were unreachable; nothing is shown rather than invented curves.' };
    return { data: { curves }, ...providerFor(sources), asOf: now() };
  });
}

// ───────────── Portfolio simulator ─────────────

export async function getPortfolioSim(symbols: string[], weights: number[], range: '1Y' | '5Y', rebalance: 'none' | 'monthly' | 'quarterly', capital: number, benchmark: string): Promise<Envelope<PortfolioResult & { labels: string[]; times: number[] }>> {
  const all = [...symbols, benchmark];
  const series = await mapLimit(all, 4, (s) => daily(s, range));
  const al = alignDaily(series);
  if (al.days.length < 20) throw new Error('not enough overlapping data');
  const per = range === '5Y' ? { monthly: 4, quarterly: 13 } : { monthly: 21, quarterly: 63 };
  const reb = rebalance === 'none' ? 0 : per[rebalance];
  const res = simulatePortfolio(al.closes.slice(0, symbols.length), weights, capital, reb, al.closes[symbols.length], range === '5Y' ? 52 : 252);
  const step = Math.max(1, Math.floor(al.days.length / 260));
  return {
    data: { ...res, labels: series.slice(0, symbols.length).map((s) => s.label), times: al.days.filter((_, i) => i % step === 0 || i === al.days.length - 1).map((d) => d * 86400) },
    ...providerFor(series.map((s) => s.source)),
    asOf: now(),
  };
}
