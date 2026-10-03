import type { Candle } from '../../../shared/types';
import { fetchJson, UpstreamError } from '../http';

/**
 * Binance public market-data API (no key, free, redistribution of public
 * market data is permitted for display). data-api.binance.vision is Binance's
 * market-data-only mirror and is tried first because it isn't geo-blocked.
 */
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function get<T>(path: string): Promise<T> {
  let lastErr: unknown;
  for (const h of HOSTS) {
    try {
      return await fetchJson<T>(h + path);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new UpstreamError('binance failed');
}

export interface BinanceTicker {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
  time: number;
}

interface RawTicker {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  prevClosePrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  closeTime: number;
}

export async function binanceTickers(symbols: string[]): Promise<BinanceTicker[]> {
  const q = encodeURIComponent(JSON.stringify(symbols.map((s) => s.toUpperCase())));
  const raw = await get<RawTicker[]>(`/api/v3/ticker/24hr?symbols=${q}`);
  return raw.map(parseBinanceTicker);
}

export function parseBinanceTicker(t: RawTicker): BinanceTicker {
  const price = Number(t.lastPrice);
  const change = Number(t.priceChange);
  return {
    symbol: t.symbol,
    price,
    change,
    changePct: Number(t.priceChangePercent),
    // 24h "previous" = open 24h ago (prevClosePrice is the last trade before the window and can be stale).
    prevClose: Number(t.openPrice) || price - change,
    high: Number(t.highPrice),
    low: Number(t.lowPrice),
    volume: Number(t.volume),
    quoteVolume: Number(t.quoteVolume),
    time: t.closeTime,
  };
}

const INTERVALS: Record<string, string> = { '1m': '1m', '5m': '5m', '15m': '15m', '1h': '1h', '60m': '1h', '4h': '4h', '1d': '1d', '1wk': '1w', '1w': '1w' };

export async function binanceKlines(symbol: string, interval = '1d', limit = 365): Promise<Candle[]> {
  const iv = INTERVALS[interval] ?? '1d';
  const raw = await get<unknown[][]>(`/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${iv}&limit=${Math.min(limit, 1000)}`);
  return parseBinanceKlines(raw);
}

export function parseBinanceKlines(raw: unknown[][]): Candle[] {
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}
