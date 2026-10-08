import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Must run before the modules below are imported (config reads env at load time).
vi.hoisted(() => {
  process.env.DATA_MODE = 'demo';
  process.env.DEV_GRANT_PRO = '';
  process.env.REQUIRE_LOGIN = 'false';
});
import type { Candle } from '../../shared/types';
import { combineOn, parseFredCsv, yoy } from '../src/providers/fred';
import { parseCompanyFacts, parseCot, parsePolymarketEvents } from '../src/providers/feeds';
import { fundingGauge, netLiquidity, recessionGauge, summarise, transform } from '../src/services/macroUs';
import { contractSymbols, curveShape, realisedVolSeries } from '../src/services/research';
import {
  adx,
  aggregateCandles,
  alignDaily,
  atr,
  bollinger,
  breadth,
  fxStrength,
  indicatorSummary,
  macd,
  meanReversionRead,
  ratioStats,
  regression,
  rrg,
  seriesStats,
  simulatePortfolio,
  structureRead,
  supportResistance,
  swingPoints,
  trendRead,
} from '../src/services/ta';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');

/** Deterministic candles: a trend plus a sine wave so swings exist. */
function makeCandles(n: number, drift = 0.2, amp = 5): Candle[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + i * drift + Math.sin(i / 4) * amp;
    return { time: 1_700_000_000 + i * 86400, open: close - 0.5, high: close + 1, low: close - 1, close, volume: 1000 };
  });
}

const VALID_READS = new Set(['positive', 'negative', 'neutral', 'stretched']);

describe('technical indicators', () => {
  const c = makeCandles(260);
  const closes = c.map((x) => x.close);

  it('bollinger bands bracket the mean', () => {
    const b = bollinger(closes);
    const i = closes.length - 1;
    expect(b.upper[i]!).toBeGreaterThan(b.mid[i]!);
    expect(b.lower[i]!).toBeLessThan(b.mid[i]!);
    expect(b.mid[18]).toBeNull();
  });

  it('macd histogram = line − signal', () => {
    const m = macd(closes);
    const i = closes.length - 1;
    expect(m.hist[i]).toBeCloseTo(m.line[i]! - m.signal[i]!, 9);
  });

  it('atr and adx are positive and bounded', () => {
    expect(atr(c)[c.length - 1]!).toBeGreaterThan(0);
    const a = adx(c).adx[c.length - 1]!;
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(100);
  });

  it('indicator summary uses descriptive reads only (no buy/sell)', () => {
    const s = indicatorSummary(c);
    expect(s.length).toBeGreaterThan(8);
    for (const r of s) {
      expect(VALID_READS.has(r.read)).toBe(true);
      expect(`${r.name} ${r.note}`).not.toMatch(/\b(buy|sell)\b/i);
    }
  });

  it('trend read: rising series scores up, falling scores down', () => {
    expect(trendRead(makeCandles(200, 0.5, 1)).trend).toBe('up');
    expect(trendRead(makeCandles(200, -0.5, 1).map((x) => ({ ...x }))).trend).toBe('down');
    const t = trendRead(c);
    expect(t.score).toBeGreaterThanOrEqual(-100);
    expect(t.score).toBeLessThanOrEqual(100);
  });

  it('mean reversion flags a price far above its band', () => {
    const flat = makeCandles(100, 0, 0.5);
    flat[flat.length - 1] = { ...flat[flat.length - 1], close: 130, high: 131 };
    const m = meanReversionRead(flat);
    expect(m.state).toBe('extended-above');
    expect(m.pctB).toBeGreaterThan(1);
  });

  it('swings, levels and structure', () => {
    const { highs, lows } = swingPoints(c);
    expect(highs.length).toBeGreaterThan(3);
    expect(lows.length).toBeGreaterThan(3);
    const lv = supportResistance(c);
    const px = c[c.length - 1].close;
    expect(lv.supports.every((l) => l.price < px)).toBe(true);
    expect(lv.resistances.every((l) => l.price > px)).toBe(true);
    expect(structureRead(makeCandles(200, 0.6, 5)).bias).toBe('uptrend');
  });

  it('aggregates hourly candles into 4-hour bars', () => {
    const h = makeCandles(9);
    const g = aggregateCandles(h, 4);
    expect(g).toHaveLength(3);
    expect(g[0].high).toBe(Math.max(...h.slice(0, 4).map((x) => x.high)));
    expect(g[0].close).toBe(h[3].close);
    expect(g[2].close).toBe(h[8].close);
  });
});

describe('statistics, regression, ratio', () => {
  it('series stats: drawdown, volatility, histogram', () => {
    const s = seriesStats([100, 110, 99, 120, 108, 130]);
    expect(s.maxDrawdownPct).toBe(-10);
    expect(s.totalReturnPct).toBe(30);
    expect(s.volAnnPct).toBeGreaterThan(0);
    expect(s.histogram.reduce((a, b) => a + b.count, 0)).toBe(5);
  });

  it('regression recovers a known beta', () => {
    const x = [100];
    const y = [100];
    for (let i = 1; i < 300; i++) {
      const r = Math.sin(i * 1.7) * 0.01;
      x.push(x[i - 1] * (1 + r));
      y.push(y[i - 1] * (1 + 2 * r));
    }
    const reg = regression(y, x);
    expect(reg.beta).toBeCloseTo(2, 2);
    expect(reg.correlation).toBeCloseTo(1, 2);
  });

  it('ratio percentile and z-score', () => {
    const r = ratioStats([1, 2, 3, 4, 10], [1, 1, 1, 1, 1]);
    expect(r.current).toBe(10);
    expect(r.percentile).toBe(100);
    expect(r.zScore).toBeGreaterThan(1);
  });

  it('aligns series on common days only', () => {
    const d = 86400;
    const al = alignDaily([
      { times: [0, d, 2 * d, 3 * d], closes: [1, 2, 3, 4] },
      { times: [d, 3 * d], closes: [20, 40] },
    ]);
    expect(al.days).toEqual([1, 3]);
    expect(al.closes).toEqual([[2, 4], [20, 40]]);
  });
});

describe('cross-asset', () => {
  it('fx strength: a currency that rose vs USD ranks above USD', () => {
    const rows = fxStrength({ EUR: [1, 1.1], IDR: [1, 0.9] }, 1);
    expect(rows.map((r) => r.ccy)).toEqual(['EUR', 'USD', 'IDR']);
    expect(rows.reduce((a, r) => a + r.strength, 0)).toBeCloseTo(0, 6);
  });

  it('rrg: accelerating outperformance is leading; fading outperformance is weakening', () => {
    const bench = Array.from({ length: 200 }, (_, i) => 100 + i * 0.1);
    const accel = bench.map((v, i) => v * (1 + 0.00002 * i * i));
    const fading = bench.map((v, i) => v * (1 + 0.3 * (1 - Math.exp(-i / 40))));
    expect(rrg(accel, bench).at(-1)!.quadrant).toBe('leading');
    expect(rrg(fading, bench).at(-1)!.quadrant).toBe('weakening');
  });

  it('breadth counts members above averages', () => {
    const up = Array.from({ length: 260 }, (_, i) => 100 + i);
    const down = Array.from({ length: 260 }, (_, i) => 400 - i);
    const b = breadth([up, down]);
    expect(b).toMatchObject({ members: 2, advancers: 1, decliners: 1, pctAbove50: 50, pctAbove200: 50, newHighs: 1, newLows: 1 });
  });

  it('portfolio: equal-weight of two flat assets keeps its value', () => {
    const r = simulatePortfolio([[10, 10, 10], [5, 5, 5]], [1, 1], 1000, 1);
    expect(r.finalValue).toBe(1000);
    const g = simulatePortfolio([[10, 20], [10, 10]], [1, 1], 1000, 0);
    expect(g.finalValue).toBe(1500);
  });

  it('realised vol, futures symbols and curve shape', () => {
    expect(realisedVolSeries([100, 101, 100, 101, 100, 101], 3, 252)[0]).toBeGreaterThan(0);
    const syms = contractSymbols('GC', 'CMX', 'GJMQVZ', new Date(Date.UTC(2026, 9, 9)), 3);
    expect(syms).toEqual(['GCZ26.CMX', 'GCG27.CMX', 'GCJ27.CMX']); // starts from next month
    expect(contractSymbols('CL', 'NYM', 'FGHJKMNQUVXZ', new Date(Date.UTC(2026, 11, 1)), 2)).toEqual(['CLF27.NYM', 'CLG27.NYM']);
    expect(curveShape([60, 61, 62, 63]).shape).toBe('contango');
    expect(curveShape([63, 62, 61, 60]).shape).toBe('backwardation');
  });
});

describe('FRED + US macro', () => {
  it('parses both CSV header styles and skips missing "." values', () => {
    expect(parseFredCsv(fx('fred-dgs10.csv'))).toEqual([
      { date: '2026-09-28', value: 4.12 },
      { date: '2026-09-30', value: 4.15 },
      { date: '2026-10-01', value: 4.09 },
    ]);
    expect(parseFredCsv(fx('fred-legacy.csv'))).toHaveLength(2);
    expect(() => parseFredCsv('<html>error</html>')).toThrow();
  });

  it('year-over-year and series summary', () => {
    const pts = Array.from({ length: 24 }, (_, i) => ({ date: `2025-${String((i % 12) + 1).padStart(2, '0')}-01`, value: 100 + i }));
    const y = yoy(pts, 12);
    expect(y[0].value).toBeCloseTo(12, 1);
    const s = summarise({ id: 'X', name: 'x', units: '%', frequency: 'monthly' }, pts);
    expect(s.change).toBe(1);
    expect(s.yearAgo).toBe(111);
    expect(transform({ id: 'X', name: 'x', units: '$bn', frequency: 'weekly', transform: 'k-to-m' }, [{ date: '2026-01-01', value: 7000000 }])[0].value).toBe(7000);
  });

  it('net liquidity = assets − TGA − RRP', () => {
    const d = (date: string, value: number) => ({ date, value });
    const nl = netLiquidity({
      WALCL: [d('2026-09-23', 6600), d('2026-09-30', 6650)],
      WTREGEN: [d('2026-09-23', 800), d('2026-09-30', 850)],
      RRPONTSYD: [d('2026-09-22', 100), d('2026-09-29', 50), d('2026-09-30', 40)],
    });
    expect(nl.points).toEqual([d('2026-09-23', 5700), d('2026-09-30', 5760)]);
    expect(combineOn([d('2026-01-01', 1)], [[d('2026-01-05', 1)]], (a) => a)).toEqual([]); // no earlier value → skipped
  });

  it('funding and recession gauges stay within 0–100 and explain themselves', () => {
    const d = (value: number) => [{ date: '2026-10-01', value }];
    const calm = fundingGauge({ SOFR: d(4.3), IORB: d(4.4), SOFR99: d(4.35), RRPONTSYD: d(400), RPONTSYD: d(0) });
    const tight = fundingGauge({ SOFR: d(4.5), IORB: d(4.4), SOFR99: d(4.8), RRPONTSYD: d(20), RPONTSYD: d(25) });
    expect(calm.label).toBe('Calm');
    expect(tight.score).toBeGreaterThan(calm.score);
    expect(tight.explain).toHaveLength(4);
    const r = recessionGauge({ SAHMREALTIME: d(0.6), T10Y3M: d(-0.5), ICSA: d(250), UNRATE: d(4.5) });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.explain[0]).toMatch(/triggered/);
  });
});

describe('official feeds', () => {
  it('CFTC COT: net positions, weekly change, COT index; ignores unknown/bad rows', () => {
    const rows = parseCot(JSON.parse(fx('cftc-cot.json')));
    expect(rows.map((r) => r.market)).toEqual(['Gold', 'WTI Crude Oil']);
    const gold = rows[0];
    expect(gold).toMatchObject({ date: '2026-09-29', netSpec: 240000, netSpecChange: 30000, netPctOi: 48, cotIndex: 100 });
    expect(gold.history).toHaveLength(3);
    expect(() => parseCot([])).toThrow();
  });

  it('SEC company facts: annual figures by frame, no double counting, ratios', () => {
    const f = parseCompanyFacts(JSON.parse(fx('sec-companyfacts.json')), 'AAPL');
    expect(f.name).toBe('Apple Inc.');
    expect(f.cik).toBe('0000320193');
    const fy24 = f.annual.find((a) => a.fy === 2024)!;
    expect(fy24.revenue).toBe(391035000000);
    expect(fy24.assets).toBe(364980000000); // Q4 instant frame, not the Q3 one
    expect(fy24.eps).toBe(6.08);
    expect(f.annual.map((a) => a.fy)).toEqual([2023, 2024]);
    const g = f.ratios.find((r) => r.name === 'Revenue growth')!;
    expect(g.value).toBeCloseTo(2.0, 1);
    expect(f.ratios.find((r) => r.name === 'Free cash flow')!.value).toBeCloseTo(108.81, 2);
  });

  it('Polymarket: parses JSON-string outcomes, drops closed and broken markets', () => {
    const m = parsePolymarketEvents(JSON.parse(fx('polymarket-events.json')), 'Fed rates');
    expect(m.map((x) => x.id)).toEqual(['501', '502']);
    expect(m[0].outcomes).toEqual([{ name: 'Yes', probability: 62 }, { name: 'No', probability: 38 }]);
    expect(m[0].category).toBe('Fed rates');
    expect(m[1].volume).toBe(3000);
  });
});

describe('/api/research routes (demo mode)', () => {
  let app: typeof import('../src/index').app;
  beforeAll(async () => {
    app = (await import('../src/index')).app;
  });
  const get = (p: string) => app.request(p);

  it('technicals: three timeframes, demo-labelled offline', async () => {
    const r = await get('/api/research/technicals?symbol=BBCA');
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.source).toBe('demo');
    expect(j.data.frames.map((f: { tf: string }) => f.tf)).toEqual(['1D', '4H', '15M']);
  });

  it('analytics endpoints answer and validate input', async () => {
    for (const p of ['/api/research/stats?symbol=^JKSE&range=1Y', '/api/research/regression?y=BBCA&x=^JKSE&range=1Y', '/api/research/ratio?a=GC=F&b=SI=F&range=5Y', '/api/research/compare?symbols=^JKSE,^GSPC&range=1Y', '/api/research/fx-strength', '/api/research/rotation?universe=countries', '/api/research/volatility', '/api/research/portfolio?symbols=BBCA,TLKM&weights=60,40&range=1Y&rebalance=quarterly&capital=100000000&benchmark=^JKSE']) {
      const r = await get(p);
      expect(r.status, p).toBe(200);
      expect((await r.json()).source, p).toBe('demo');
    }
    expect((await get('/api/research/stats?symbol=X&range=3M')).status).toBe(400);
    expect((await get('/api/research/rotation?universe=nope')).status).toBe(400);
    expect((await get('/api/research/portfolio?symbols=A,B&weights=1')).status).toBe(400);
  });

  it('macro topics return series + gauges, labelled demo when FRED is unreachable', async () => {
    const r = await (await get('/api/research/macro/funding')).json();
    expect(r.source).toBe('demo');
    expect(r.data.gauge.score).toBeGreaterThanOrEqual(0);
    expect(r.data.series.length).toBe(5);
    expect((await get('/api/research/macro/nope')).status).toBe(400);
  });

  it('official feeds never invent data: 502 when the source is unreachable', async () => {
    for (const p of ['/api/research/cot', '/api/research/fundamentals?ticker=AAPL', '/api/research/predictions?topic=economy']) {
      const r = await get(p);
      expect(r.status, p).toBe(502);
      expect((await r.json()).code).toBe('upstream');
    }
    expect((await get('/api/research/fundamentals?ticker=BBCA.JK')).status).toBe(400);
  });

  it('futures term structure shows nothing rather than invented curves', async () => {
    const j = await (await get('/api/research/term-structure')).json();
    expect(j.data.curves).toEqual([]);
  });

  it('source status lists every probe', async () => {
    const j = await (await get('/api/research/sources-status')).json();
    expect(j.dataMode).toBe('demo');
    expect(j.sources.length).toBeGreaterThan(6);
    expect(j.sources.every((s: { ok: boolean }) => s.ok === false)).toBe(true);
  });
});
