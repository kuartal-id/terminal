import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBinanceKlines, parseBinanceTicker } from '../src/providers/binance';
import { buildCurve, parseTreasuryCsv, parseWorldBank } from '../src/providers/official';
import { parseFeed, type FeedDef } from '../src/providers/rss';
import { parseYahooChart } from '../src/providers/yahoo';
import { demoCandles } from '../src/providers/demo';

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

describe('yahoo chart parser', () => {
  it('parses candles, skips null bars, and uses the previous session as prevClose', () => {
    const c = parseYahooChart(JSON.parse(fx('yahoo-chart.json')));
    expect(c.symbol).toBe('BBCA.JK');
    expect(c.currency).toBe('IDR');
    expect(c.price).toBe(7700);
    expect(c.candles).toHaveLength(4); // one null bar dropped
    // previousClose missing → second-to-last close (same trading day as regularMarketTime)
    expect(c.prevClose).toBe(7725);
    expect(c.name).toBe('PT Bank Central Asia Tbk');
    expect(c.time).toBe(1759465200 * 1000);
  });

  it('throws a readable error when Yahoo returns no result', () => {
    expect(() => parseYahooChart(JSON.parse(fx('yahoo-error.json')))).toThrow(/delisted/);
  });
});

describe('binance parsers', () => {
  it('parses 24h ticker strings into numbers', () => {
    const [t] = (JSON.parse(fx('binance-ticker.json')) as never[]).map(parseBinanceTicker);
    expect(t.symbol).toBe('BTCUSDT');
    expect(t.price).toBe(76823);
    expect(t.changePct).toBeCloseTo(-1.174);
    expect(t.prevClose).toBe(77735.5); // uses 24h open, not stale prevClosePrice
    expect(t.quoteVolume).toBeGreaterThan(1e9);
  });

  it('parses klines into second-based candles', () => {
    const k = parseBinanceKlines(JSON.parse(fx('binance-klines.json')));
    expect(k).toHaveLength(2);
    expect(k[1]).toEqual({ time: 1759449600, open: 77735.5, high: 78120, low: 76400, close: 76823, volume: 21450.1 });
  });
});

describe('rss parser', () => {
  const feed: FeedDef = { id: 't', name: 'Test', url: 'https://x', region: 'id', topics: ['markets'] };

  it('parses RSS 2.0 items, decodes CDATA/entities, drops empty titles', () => {
    const items = parseFeed(fx('rss.xml'), feed);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe('IHSG Ditutup Menguat, Saham Bank & Tambang Jadi Penopang');
    expect(items[0].url).toBe('https://www.example.co.id/market/20261002/ihsg');
    expect(items[0].published).toBe('2026-10-02T09:15:00.000Z');
    expect(items[1].published).toBe('2026-10-02T01:00:00.000Z'); // +0700 respected
    expect(items[0].source).toBe('Test');
    expect(items[0].region).toBe('id');
    expect(items[0].id).not.toBe(items[1].id);
  });

  it('parses Atom entries with link href', () => {
    const items = parseFeed(fx('atom.xml'), { ...feed, region: 'global' });
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.org/press/1');
  });
});

describe('treasury yield curve', () => {
  it('parses CSV rows newest-first with tenor labels', () => {
    const rows = parseTreasuryCsv(fx('treasury.csv'));
    expect(rows.map((r) => r.date)).toEqual(['2026-10-02', '2026-10-01', '2026-09-02']);
    const ten = rows[0].points.find((p) => p.tenor === '10Y');
    expect(ten).toEqual({ tenor: '10Y', months: 120, value: 4.83 });
    expect(rows[0].points).toHaveLength(14);
  });

  it('builds a curve with a ~1 month comparison', () => {
    const curve = buildCurve(parseTreasuryCsv(fx('treasury.csv')));
    expect(curve.date).toBe('2026-10-02');
    expect(curve.compare.find((c) => c.label === '1M ago')?.date).toBe('2026-09-02');
  });
});

describe('world bank', () => {
  it('groups by country and sorts years ascending, keeping nulls', () => {
    const s = parseWorldBank(JSON.parse(fx('worldbank.json')), 'FP.CPI.TOTL.ZG');
    expect(s.map((x) => x.country)).toEqual(['IDN', 'VNM']);
    expect(s[0].points).toEqual([{ year: 2023, value: 3.7 }, { year: 2024, value: 2.3 }]);
    expect(s[1].points[1]).toEqual({ year: 2024, value: null });
    expect(s[1].countryName).toBe('Vietnam'); // our label, not the API's
  });

  it('throws on World Bank error payloads', () => {
    expect(() => parseWorldBank(JSON.parse(fx('worldbank-error.json')), 'X')).toThrow(/worldbank/);
  });
});

describe('demo generator', () => {
  it('is deterministic per symbol and ends at the anchor', () => {
    const a = demoCandles('^JKSE', 50);
    const b = demoCandles('^JKSE', 50);
    expect(a).toEqual(b);
    expect(a.at(-1)!.close).toBe(7150);
    for (const c of a) {
      expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close) - 1e-9);
      expect(c.low).toBeLessThanOrEqual(Math.min(c.open, c.close) + 1e-9);
    }
  });
});
