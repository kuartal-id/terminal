import type { Candle } from '../../../shared/types';
import { fetchJson, UpstreamError } from '../http';

/**
 * Yahoo Finance public chart endpoint (no key, no cost).
 *
 * ⚠️  This endpoint is unofficial and Yahoo's terms don't grant redistribution
 * rights. It's fine for a free community tool and for development, but before
 * charging money for equity/index data, swap this provider for a licensed or
 * clearly-permitted source. Everything that uses it goes through
 * services/quotes.ts, so swapping is a one-file change. See docs/DATA_SOURCES.md.
 */

export interface YahooChart {
  symbol: string;
  name?: string;
  currency?: string;
  price: number;
  prevClose: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  time: number;
  candles: Candle[];
}

interface RawChart {
  chart: {
    result?: {
      meta: {
        symbol: string;
        currency?: string;
        shortName?: string;
        longName?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketVolume?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators: {
        quote: {
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }[];
      };
    }[];
    error?: { code: string; description: string } | null;
  };
}

const HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

export async function yahooChart(symbol: string, range = '1mo', interval = '1d'): Promise<YahooChart> {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  let lastErr: unknown;
  for (const host of HOSTS) {
    try {
      const raw = await fetchJson<RawChart>(host + path);
      return parseYahooChart(raw);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new UpstreamError('yahoo failed');
}

/** Pure parser — unit tested against a recorded fixture. */
export function parseYahooChart(raw: RawChart): YahooChart {
  const r = raw?.chart?.result?.[0];
  if (!r) throw new UpstreamError(raw?.chart?.error?.description ?? 'yahoo: empty result');
  const q = r.indicators?.quote?.[0] ?? {};
  const ts = r.timestamp ?? [];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 });
  }
  const m = r.meta;
  const last = candles[candles.length - 1];
  const price = m.regularMarketPrice ?? last?.close;
  if (price == null) throw new UpstreamError(`yahoo: no price for ${m.symbol}`);

  // Daily change must be vs the previous *session*, not the start of the range.
  let prevClose = m.previousClose;
  if (prevClose == null && candles.length >= 2) {
    const lastDay = last ? dayKey(last.time) : '';
    const marketDay = m.regularMarketTime ? dayKey(m.regularMarketTime) : lastDay;
    prevClose = lastDay === marketDay ? candles[candles.length - 2].close : last.close;
  }
  prevClose ??= m.chartPreviousClose ?? price;

  return {
    symbol: m.symbol,
    name: m.longName ?? m.shortName,
    currency: m.currency,
    price,
    prevClose,
    dayHigh: m.regularMarketDayHigh,
    dayLow: m.regularMarketDayLow,
    volume: m.regularMarketVolume,
    time: (m.regularMarketTime ?? last?.time ?? Date.now() / 1000) * 1000,
    candles,
  };
}

function dayKey(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}
