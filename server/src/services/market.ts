import type { DataSource, Envelope, History, Quote } from '../../../shared/types';
import { isCrypto, resolveInstrument } from '../../../shared/instruments';
import { cache, mapLimit } from '../cache';
import { binanceKlines, binanceTickers } from '../providers/binance';
import { demoCandles } from '../providers/demo';
import { yahooChart } from '../providers/yahoo';

/**
 * The ONE place that decides which provider serves which symbol.
 * To swap Yahoo for a licensed equity feed later, change only this file.
 */

const QUOTE_TTL = 30_000;
const CRYPTO_TTL = 10_000;
const HISTORY_TTL = 5 * 60_000;

const RANK: DataSource[] = ['live', 'delayed', 'eod', 'static', 'demo'];
export function worstSource(sources: DataSource[]): DataSource {
  return sources.reduce<DataSource>((w, s) => (RANK.indexOf(s) > RANK.indexOf(w) ? s : w), 'live');
}

function meta(symbol: string) {
  const inst = resolveInstrument(symbol)!;
  return { label: inst.label, name: inst.name, assetClass: inst.assetClass, currency: inst.currency };
}

function demoQuote(symbol: string): Quote {
  const c = demoCandles(symbol, 30);
  const last = c[c.length - 1];
  const prev = c[c.length - 2];
  return {
    symbol,
    ...meta(symbol),
    price: last.close,
    prevClose: prev.close,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    dayHigh: last.high,
    dayLow: last.low,
    volume: last.volume,
    time: Date.now(),
    source: 'demo',
    spark: c.slice(-20).map((x) => x.close),
  };
}

async function yahooQuote(symbol: string): Promise<Quote> {
  return cache.get(`q:${symbol}`, QUOTE_TTL, async () => {
    try {
      const ch = await yahooChart(symbol, '1mo', '1d');
      const m = meta(symbol);
      return {
        symbol,
        ...m,
        name: m.name === symbol && ch.name ? ch.name : m.name,
        currency: ch.currency ?? m.currency,
        price: ch.price,
        prevClose: ch.prevClose,
        change: ch.price - ch.prevClose,
        changePct: ch.prevClose ? ((ch.price - ch.prevClose) / ch.prevClose) * 100 : 0,
        dayHigh: ch.dayHigh,
        dayLow: ch.dayLow,
        volume: ch.volume,
        time: ch.time,
        // Yahoo's free feed is typically ~15 min delayed for exchanges like IDX.
        source: 'delayed' as DataSource,
        spark: ch.candles.slice(-20).map((c) => c.close),
      };
    } catch {
      return demoQuote(symbol);
    }
  });
}

async function cryptoQuotes(symbols: string[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  const key = `cq:${[...symbols].sort().join(',')}`;
  return cache.get(key, CRYPTO_TTL, async () => {
    try {
      const ts = await binanceTickers(symbols);
      const map = new Map(ts.map((t) => [t.symbol, t]));
      return symbols.map((s) => {
        const t = map.get(s.toUpperCase());
        if (!t) return demoQuote(s);
        return {
          symbol: s,
          ...meta(s),
          price: t.price,
          prevClose: t.prevClose,
          change: t.change,
          changePct: t.changePct,
          dayHigh: t.high,
          dayLow: t.low,
          volume: t.quoteVolume,
          time: t.time,
          source: 'live' as DataSource,
        };
      });
    } catch {
      return symbols.map(demoQuote);
    }
  });
}

export async function getQuotes(rawSymbols: string[]): Promise<Envelope<Quote[]>> {
  const symbols = [...new Set(rawSymbols.map((s) => resolveInstrument(s)?.symbol ?? s))].slice(0, 120);
  const crypto = symbols.filter(isCrypto);
  const other = symbols.filter((s) => !isCrypto(s));
  const [cq, oq] = await Promise.all([cryptoQuotes(crypto), mapLimit(other, 6, yahooQuote)]);
  const bySym = new Map([...cq, ...oq].map((q) => [q.symbol, q]));
  const data = symbols.map((s) => bySym.get(s)!).filter(Boolean);
  const source = worstSource(data.map((q) => q.source));
  const providers = [cq.some((q) => q.source !== 'demo') ? 'Binance' : '', oq.some((q) => q.source !== 'demo') ? 'Yahoo Finance (unofficial)' : '', data.some((q) => q.source === 'demo') ? 'Kuartal demo generator' : ''];
  return {
    data,
    source,
    provider: providers.filter(Boolean).join(' + '),
    asOf: new Date().toISOString(),
    note: source === 'demo' ? 'Some or all prices are DEMO data because the upstream source was unreachable.' : undefined,
  };
}

const RANGE_FOR: Record<string, { range: string; interval: string; cryptoInterval: string; limit: number }> = {
  '1D': { range: '1d', interval: '5m', cryptoInterval: '5m', limit: 288 },
  '5D': { range: '5d', interval: '15m', cryptoInterval: '15m', limit: 480 },
  '1M': { range: '1mo', interval: '1h', cryptoInterval: '1h', limit: 720 },
  '6M': { range: '6mo', interval: '1d', cryptoInterval: '1d', limit: 183 },
  '1Y': { range: '1y', interval: '1d', cryptoInterval: '1d', limit: 365 },
  '5Y': { range: '5y', interval: '1wk', cryptoInterval: '1w', limit: 260 },
  MAX: { range: 'max', interval: '1mo', cryptoInterval: '1w', limit: 1000 },
};

export const HISTORY_RANGES = Object.keys(RANGE_FOR);

export async function getHistory(rawSymbol: string, rangeKey = '1Y'): Promise<Envelope<History>> {
  const inst = resolveInstrument(rawSymbol);
  if (!inst) throw new Error('unknown symbol');
  const spec = RANGE_FOR[rangeKey] ?? RANGE_FOR['1Y'];
  const symbol = inst.symbol;
  return cache.get(`h:${symbol}:${rangeKey}`, HISTORY_TTL, async () => {
    let candles;
    let source: DataSource = 'delayed';
    let provider = 'Yahoo Finance (unofficial)';
    let currency = inst.currency;
    try {
      if (isCrypto(symbol)) {
        candles = await binanceKlines(symbol, spec.cryptoInterval, spec.limit);
        source = 'live';
        provider = 'Binance';
      } else {
        const ch = await yahooChart(symbol, spec.range, spec.interval);
        candles = ch.candles;
        currency = ch.currency ?? currency;
      }
      if (!candles.length) throw new Error('empty');
    } catch {
      const step = spec.interval.endsWith('m') ? Number(spec.interval.replace('m', '')) * 60 : spec.interval === '1h' ? 3600 : spec.interval === '1wk' ? 604800 : spec.interval === '1mo' ? 2592000 : 86400;
      candles = demoCandles(symbol, Math.min(spec.limit, 400), step);
      source = 'demo';
      provider = 'Kuartal demo generator';
    }
    return {
      data: { symbol, label: inst.label, interval: spec.interval, range: rangeKey, candles, currency },
      source,
      provider,
      asOf: new Date().toISOString(),
    };
  });
}

/** Daily closes for analytics (pulse, correlation, seasonality). */
export async function dailyCloses(symbol: string, rangeKey: '6M' | '1Y' | '5Y' | 'MAX' = '1Y') {
  const h = await getHistory(symbol, rangeKey);
  return { closes: h.data.candles.map((c) => c.close), times: h.data.candles.map((c) => c.time), source: h.source };
}
