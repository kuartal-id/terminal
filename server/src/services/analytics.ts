import type { CorrelationMatrix, Envelope, Seasonality } from '../../../shared/types';
import { correlation, mean, returns } from '../../../shared/math';
import { resolveInstrument } from '../../../shared/instruments';
import { cache } from '../cache';
import { dailyCloses, getHistory, worstSource } from './market';

/** PRO analytics. Everything is computed from free daily data. */

/** Align series by date key and compute a Pearson correlation matrix of daily returns. Pure. */
export function correlationFromSeries(series: { times: number[]; closes: number[] }[], window: number): number[][] {
  const day = (t: number) => Math.floor(t / 86400);
  const maps = series.map((s) => new Map(s.times.map((t, i) => [day(t), s.closes[i]])));
  const common = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b).slice(-(window + 1));
  const rets = maps.map((m) => returns(common.map((d) => m.get(d)!)));
  return rets.map((a, i) => rets.map((b, j) => (i === j ? 1 : +correlation(a, b).toFixed(3))));
}

export async function getCorrelation(symbols: string[], window = 60): Promise<Envelope<CorrelationMatrix>> {
  const insts = symbols.slice(0, 12).map((s) => resolveInstrument(s)!).filter(Boolean);
  const key = `corr:${insts.map((i) => i.symbol).join(',')}:${window}`;
  return cache.get(key, 15 * 60_000, async () => {
    const series = await Promise.all(insts.map((i) => dailyCloses(i.symbol, '1Y')));
    return {
      data: { labels: insts.map((i) => i.label), symbols: insts.map((i) => i.symbol), window, matrix: correlationFromSeries(series, window) },
      source: worstSource(series.map((s) => s.source)),
      provider: 'Kuartal analytics',
      asOf: new Date().toISOString(),
    };
  });
}

/** Monthly returns table by year. Pure. Input: monthly candles (time = unix sec, close). */
export function seasonalityFromMonthly(candles: { time: number; close: number }[]): Pick<Seasonality, 'rows' | 'average' | 'hitRate'> {
  const byYear = new Map<number, (number | null)[]>();
  for (let i = 1; i < candles.length; i++) {
    const d = new Date(candles[i].time * 1000);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const prev = candles[i - 1].close;
    if (!byYear.has(y)) byYear.set(y, Array(12).fill(null));
    byYear.get(y)![m] = prev ? +(((candles[i].close - prev) / prev) * 100).toFixed(2) : null;
  }
  const rows = [...byYear.entries()].sort((a, b) => b[0] - a[0]).map(([year, months]) => ({ year, months }));
  const average: (number | null)[] = [];
  const hitRate: (number | null)[] = [];
  for (let m = 0; m < 12; m++) {
    const vals = rows.map((r) => r.months[m]).filter((v): v is number => v != null);
    average.push(vals.length ? +mean(vals).toFixed(2) : null);
    hitRate.push(vals.length ? Math.round((vals.filter((v) => v > 0).length / vals.length) * 100) : null);
  }
  return { rows, average, hitRate };
}

export async function getSeasonality(symbol: string): Promise<Envelope<Seasonality>> {
  const h = await getHistory(symbol, 'MAX');
  const last15 = h.data.candles.filter((c) => c.time > Date.now() / 1000 - 16 * 365 * 86400);
  return {
    data: { symbol: h.data.symbol, label: h.data.label, ...seasonalityFromMonthly(last15) },
    source: h.source,
    provider: h.provider,
    asOf: h.asOf,
  };
}
