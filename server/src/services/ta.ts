import type { Candle } from '../../../shared/types';
import type {
  BreadthStats,
  IndicatorReading,
  Level,
  MeanReversionRead,
  PortfolioResult,
  RatioStats,
  RegressionStats,
  RrgPoint,
  SeriesStats,
  StructureRead,
  TrendRead,
} from '../../../shared/research';
import { ema, mean, rsi, sma, stdev } from '../../../shared/math';

/**
 * Pure technical / statistical analytics used by the research panels.
 * No I/O here — every function is unit-tested in server/test/ta.test.ts.
 *
 * Readings are DESCRIPTIVE ("price above its 50-day average"), never
 * recommendations. Labels are positive / negative / neutral, not buy / sell.
 */

const last = <T>(xs: T[]): T => xs[xs.length - 1];
const lastNum = (xs: (number | null)[]): number | null => {
  for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null && isFinite(xs[i]!)) return xs[i]!;
  return null;
};
const round = (v: number, d = 2) => (isFinite(v) ? Number(v.toFixed(d)) : NaN);

// ───────────── Alignment ─────────────

/** Align several daily series on the days all of them traded. Returns closes per series on common days. */
export function alignDaily(series: { times: number[]; closes: number[] }[]): { days: number[]; closes: number[][] } {
  if (!series.length) return { days: [], closes: [] };
  const day = (t: number) => Math.floor(t / 86400);
  const maps = series.map((s) => {
    const m = new Map<number, number>();
    s.times.forEach((t, i) => {
      const c = s.closes[i];
      if (isFinite(c) && c > 0) m.set(day(t), c);
    });
    return m;
  });
  const days = [...maps[0].keys()].filter((d) => maps.every((m) => m.has(d))).sort((a, b) => a - b);
  return { days, closes: maps.map((m) => days.map((d) => m.get(d)!)) };
}

/** Group intraday candles into N-candle buckets (e.g. 60m → 4H with n=4). */
export function aggregateCandles(candles: Candle[], n: number): Candle[] {
  if (n <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += n) {
    const g = candles.slice(i, i + n);
    out.push({
      time: g[0].time,
      open: g[0].open,
      high: Math.max(...g.map((c) => c.high)),
      low: Math.min(...g.map((c) => c.low)),
      close: last(g).close,
      volume: g.reduce((s, c) => s + (c.volume || 0), 0),
    });
  }
  return out;
}

// ───────────── Indicators ─────────────

export function bollinger(closes: number[], period = 20, k = 2) {
  const mid = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || mid[i] == null) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    const sd = stdev(closes.slice(i - period + 1, i + 1));
    upper.push(mid[i]! + k * sd);
    lower.push(mid[i]! - k * sd);
  }
  return { mid, upper, lower };
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] != null && s[i] != null ? f[i]! - s[i]! : null));
  const start = line.findIndex((v) => v != null);
  const sig: (number | null)[] = Array(closes.length).fill(null);
  if (start >= 0) {
    const e = ema(line.slice(start) as number[], signal);
    e.forEach((v, i) => (sig[start + i] = v));
  }
  const hist = line.map((v, i) => (v != null && sig[i] != null ? v - sig[i]! : null));
  return { line, signal: sig, hist };
}

export function trueRanges(c: Candle[]): number[] {
  return c.map((x, i) => (i === 0 ? x.high - x.low : Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close))));
}

/** Wilder-smoothed average true range. */
export function atr(c: Candle[], period = 14): (number | null)[] {
  const tr = trueRanges(c);
  const out: (number | null)[] = Array(c.length).fill(null);
  if (c.length < period) return out;
  let a = mean(tr.slice(0, period));
  out[period - 1] = a;
  for (let i = period; i < c.length; i++) {
    a = (a * (period - 1) + tr[i]) / period;
    out[i] = a;
  }
  return out;
}

export function stochastic(c: Candle[], period = 14, smooth = 3) {
  const k: (number | null)[] = c.map((_, i) => {
    if (i < period - 1) return null;
    const w = c.slice(i - period + 1, i + 1);
    const hi = Math.max(...w.map((x) => x.high));
    const lo = Math.min(...w.map((x) => x.low));
    return hi === lo ? 50 : ((c[i].close - lo) / (hi - lo)) * 100;
  });
  const d = k.map((_, i) => {
    const w = k.slice(Math.max(0, i - smooth + 1), i + 1);
    return w.length === smooth && w.every((v) => v != null) ? mean(w as number[]) : null;
  });
  return { k, d };
}

/** Average Directional Index (trend strength, 0–100) with +DI / −DI. */
export function adx(c: Candle[], period = 14) {
  const n = c.length;
  const out = { adx: Array<number | null>(n).fill(null), plusDi: Array<number | null>(n).fill(null), minusDi: Array<number | null>(n).fill(null) };
  if (n < period * 2 + 1) return out;
  const tr = trueRanges(c);
  const pdm = c.map((x, i) => (i === 0 ? 0 : x.high - c[i - 1].high > c[i - 1].low - x.low && x.high - c[i - 1].high > 0 ? x.high - c[i - 1].high : 0));
  const mdm = c.map((x, i) => (i === 0 ? 0 : c[i - 1].low - x.low > x.high - c[i - 1].high && c[i - 1].low - x.low > 0 ? c[i - 1].low - x.low : 0));
  let str = tr.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let sp = pdm.slice(1, period + 1).reduce((a, b) => a + b, 0);
  let sm = mdm.slice(1, period + 1).reduce((a, b) => a + b, 0);
  const dx: number[] = [];
  for (let i = period; i < n; i++) {
    if (i > period) {
      str = str - str / period + tr[i];
      sp = sp - sp / period + pdm[i];
      sm = sm - sm / period + mdm[i];
    }
    const p = str ? (sp / str) * 100 : 0;
    const m = str ? (sm / str) * 100 : 0;
    out.plusDi[i] = p;
    out.minusDi[i] = m;
    dx.push(p + m ? (Math.abs(p - m) / (p + m)) * 100 : 0);
    if (dx.length === period) out.adx[i] = mean(dx);
    else if (dx.length > period) out.adx[i] = (out.adx[i - 1]! * (period - 1) + last(dx)) / period;
  }
  return out;
}

/** Rate of change over n bars, in %. */
export function roc(closes: number[], n: number): number | null {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n];
  return a ? ((last(closes) - a) / a) * 100 : null;
}

// ───────────── Indicator summary (TIN) ─────────────

export function indicatorSummary(c: Candle[]): IndicatorReading[] {
  const closes = c.map((x) => x.close);
  const px = last(closes);
  const out: IndicatorReading[] = [];
  const add = (name: string, value: number | null, read: IndicatorReading['read'], note: string) => {
    if (value != null && isFinite(value)) out.push({ name, value: round(value, Math.abs(value) < 10 ? 3 : 2), read, note });
  };
  for (const p of [20, 50, 200]) {
    const v = lastNum(sma(closes, p));
    if (v != null) add(`SMA ${p}`, v, px > v ? 'positive' : px < v ? 'negative' : 'neutral', px > v ? 'Price above average' : 'Price below average');
  }
  for (const p of [12, 26]) {
    const v = lastNum(ema(closes, p));
    if (v != null) add(`EMA ${p}`, v, px > v ? 'positive' : 'negative', px > v ? 'Price above average' : 'Price below average');
  }
  const r = lastNum(rsi(closes, 14));
  if (r != null) add('RSI 14', r, r >= 70 ? 'stretched' : r <= 30 ? 'stretched' : r > 50 ? 'positive' : 'negative', r >= 70 ? 'Overbought zone (≥70)' : r <= 30 ? 'Oversold zone (≤30)' : r > 50 ? 'Above midline' : 'Below midline');
  const m = macd(closes);
  const mh = lastNum(m.hist);
  if (mh != null) add('MACD hist', mh, mh > 0 ? 'positive' : 'negative', mh > 0 ? 'MACD above signal' : 'MACD below signal');
  const st = stochastic(c);
  const k = lastNum(st.k);
  if (k != null) add('Stoch %K', k, k >= 80 || k <= 20 ? 'stretched' : k > 50 ? 'positive' : 'negative', k >= 80 ? 'Near top of 14-bar range' : k <= 20 ? 'Near bottom of 14-bar range' : 'Mid-range');
  const ad = adx(c);
  const a = lastNum(ad.adx);
  if (a != null) {
    const p = lastNum(ad.plusDi) ?? 0;
    const mm = lastNum(ad.minusDi) ?? 0;
    add('ADX 14', a, a < 20 ? 'neutral' : p > mm ? 'positive' : 'negative', a < 20 ? 'Weak / no trend' : `${a >= 40 ? 'Strong' : 'Moderate'} trend, ${p > mm ? '+DI' : '−DI'} leads`);
  }
  const at = lastNum(atr(c));
  if (at != null) add('ATR 14', at, 'neutral', `${round((at / px) * 100)}% of price per bar`);
  const bb = bollinger(closes);
  const up = lastNum(bb.upper);
  const lo = lastNum(bb.lower);
  if (up != null && lo != null && up !== lo) {
    const pb = (px - lo) / (up - lo);
    add('Bollinger %B', pb, pb > 1 || pb < 0 ? 'stretched' : pb > 0.5 ? 'positive' : 'negative', pb > 1 ? 'Above upper band' : pb < 0 ? 'Below lower band' : 'Inside bands');
  }
  const r10 = roc(closes, 10);
  if (r10 != null) add('ROC 10', r10, r10 > 0 ? 'positive' : 'negative', '10-bar % change');
  return out;
}

// ───────────── Trend & momentum (TRM) ─────────────

export function trendRead(c: Candle[]): TrendRead {
  const closes = c.map((x) => x.close);
  const px = last(closes);
  const e20 = lastNum(ema(closes, 20));
  const e50 = lastNum(ema(closes, 50));
  const e20s = ema(closes, 20);
  const prev = e20s.length > 6 ? e20s[e20s.length - 6] : null;
  const slope = e20 != null && prev ? ((e20 - prev) / prev) * 100 : 0;
  const r = lastNum(rsi(closes, 14)) ?? 50;
  const mh = lastNum(macd(closes).hist) ?? 0;
  const a = lastNum(adx(c).adx);
  // Score: trend (price vs EMAs, EMA alignment, slope) + momentum (RSI, MACD, ROC). −100…+100.
  let s = 0;
  if (e20 != null) s += px > e20 ? 20 : -20;
  if (e50 != null) s += px > e50 ? 20 : -20;
  if (e20 != null && e50 != null) s += e20 > e50 ? 15 : -15;
  s += Math.max(-15, Math.min(15, slope * 5));
  s += Math.max(-15, Math.min(15, (r - 50) * 0.75));
  s += mh > 0 ? 10 : -10;
  s += Math.max(-5, Math.min(5, roc(closes, 10) ?? 0));
  const score = Math.round(Math.max(-100, Math.min(100, s)));
  const trend = score >= 25 ? 'up' : score <= -25 ? 'down' : 'flat';
  const momentum = r >= 60 && mh > 0 ? 'strengthening' : r <= 40 && mh < 0 ? 'weakening' : 'mixed';
  return { trend, momentum, score, rsi: round(r, 1), macdHist: round(mh, 4), ema20: e20 != null ? round(e20, 4) : null, ema50: e50 != null ? round(e50, 4) : null, slopePct: round(slope, 2), adx: a != null ? round(a, 1) : null };
}

// ───────────── Mean reversion (MRV) ─────────────

export function meanReversionRead(c: Candle[], period = 20): MeanReversionRead {
  const closes = c.map((x) => x.close);
  const px = last(closes);
  const bb = bollinger(closes, period);
  const mid = lastNum(bb.mid);
  const up = lastNum(bb.upper);
  const lo = lastNum(bb.lower);
  const window = closes.slice(-period);
  const sd = stdev(window);
  const z = mid != null && sd ? (px - mid) / sd : 0;
  const pctB = up != null && lo != null && up !== lo ? (px - lo) / (up - lo) : 0.5;
  const bw = mid ? ((up! - lo!) / mid) * 100 : 0;
  // Band-width percentile vs the last ~120 bars → squeeze detection.
  const widths: number[] = [];
  for (let i = Math.max(period, closes.length - 120); i < closes.length; i++) {
    if (bb.mid[i] != null && bb.upper[i] != null) widths.push(((bb.upper[i]! - bb.lower[i]!) / bb.mid[i]!) * 100);
  }
  const bwPct = widths.length ? Math.round((widths.filter((w) => w <= bw).length / widths.length) * 100) : 50;
  const state = z >= 2 ? 'extended-above' : z <= -2 ? 'extended-below' : z >= 1 ? 'upper-half' : z <= -1 ? 'lower-half' : 'near-mean';
  return { price: px, mid: mid ?? px, upper: up ?? px, lower: lo ?? px, zScore: round(z), pctB: round(pctB, 3), bandwidthPct: round(bw), bandwidthPercentile: bwPct, squeeze: bwPct <= 15, state };
}

// ───────────── Swings, support/resistance, structure ─────────────

/** Fractal swing highs/lows: bar whose high/low is the extreme of `k` bars on each side. */
export function swingPoints(c: Candle[], k = 3): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = k; i < c.length - k; i++) {
    const w = c.slice(i - k, i + k + 1);
    if (c[i].high === Math.max(...w.map((x) => x.high))) highs.push(i);
    if (c[i].low === Math.min(...w.map((x) => x.low))) lows.push(i);
  }
  return { highs, lows };
}

/** Cluster swing prices within `tol` × ATR into levels; rank by touches and recency. */
export function supportResistance(c: Candle[], maxLevels = 4): { supports: Level[]; resistances: Level[] } {
  if (c.length < 20) return { supports: [], resistances: [] };
  const px = last(c).close;
  const a = lastNum(atr(c)) ?? px * 0.01;
  const { highs, lows } = swingPoints(c, 3);
  const pts = [...highs.map((i) => ({ price: c[i].high, i })), ...lows.map((i) => ({ price: c[i].low, i }))].sort((x, y) => x.price - y.price);
  const clusters: { prices: number[]; idx: number[] }[] = [];
  for (const p of pts) {
    const cl = clusters[clusters.length - 1];
    if (cl && p.price - mean(cl.prices) <= a * 0.6) {
      cl.prices.push(p.price);
      cl.idx.push(p.i);
    } else clusters.push({ prices: [p.price], idx: [p.i] });
  }
  const levels: Level[] = clusters.map((cl) => {
    const price = mean(cl.prices);
    const lastTouch = Math.max(...cl.idx);
    return { price: round(price, 6), touches: cl.prices.length, distancePct: round(((price - px) / px) * 100), barsAgo: c.length - 1 - lastTouch, strength: Math.min(100, cl.prices.length * 25 + Math.max(0, 30 - (c.length - 1 - lastTouch) / 4)) };
  });
  const byNear = (x: Level, y: Level) => Math.abs(x.distancePct) - Math.abs(y.distancePct);
  return {
    supports: levels.filter((l) => l.price < px).sort(byNear).slice(0, maxLevels),
    resistances: levels.filter((l) => l.price > px).sort(byNear).slice(0, maxLevels),
  };
}

/** Classify recent structure from the last two swing highs/lows (HH/HL, LH/LL…). */
export function structureRead(c: Candle[]): StructureRead {
  const { highs, lows } = swingPoints(c, 3);
  const hs = highs.slice(-2).map((i) => c[i].high);
  const ls = lows.slice(-2).map((i) => c[i].low);
  const hh = hs.length === 2 ? (hs[1] > hs[0] ? 'HH' : 'LH') : null;
  const hl = ls.length === 2 ? (ls[1] > ls[0] ? 'HL' : 'LL') : null;
  const bias = hh === 'HH' && hl === 'HL' ? 'uptrend' : hh === 'LH' && hl === 'LL' ? 'downtrend' : hh && hl ? 'range' : 'unclear';
  const px = last(c).close;
  const lastHigh = hs.length ? last(hs) : null;
  const lastLow = ls.length ? last(ls) : null;
  const breakOf = lastHigh != null && px > lastHigh ? 'above last swing high' : lastLow != null && px < lastLow ? 'below last swing low' : null;
  return { bias, highs: hh, lows: hl, lastSwingHigh: lastHigh, lastSwingLow: lastLow, break: breakOf };
}

// ───────────── Statistics (STA) ─────────────

export function seriesStats(closes: number[], periodsPerYear = 252): SeriesStats {
  const r = closes.slice(1).map((v, i) => (v - closes[i]) / closes[i]).filter((x) => isFinite(x));
  const n = r.length;
  const mu = mean(r);
  const sd = stdev(r);
  const m3 = n ? r.reduce((s, x) => s + (x - mu) ** 3, 0) / n : 0;
  const m4 = n ? r.reduce((s, x) => s + (x - mu) ** 4, 0) / n : 0;
  let peak = closes[0];
  let mdd = 0;
  for (const v of closes) {
    peak = Math.max(peak, v);
    mdd = Math.min(mdd, (v - peak) / peak);
  }
  const sorted = [...r].sort((a, b) => a - b);
  const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))] : 0);
  const years = n / periodsPerYear;
  const total = closes.length > 1 ? last(closes) / closes[0] - 1 : 0;
  const cagr = years > 0 && total > -1 ? (1 + total) ** (1 / years) - 1 : 0;
  // Histogram of returns, 21 bins across ±3 sd.
  const bins = 21;
  const lo = mu - 3 * sd;
  const w = (6 * sd) / bins || 1;
  const hist = Array(bins).fill(0);
  for (const x of r) hist[Math.max(0, Math.min(bins - 1, Math.floor((x - lo) / w)))]++;
  return {
    observations: n,
    totalReturnPct: round(total * 100),
    cagrPct: round(cagr * 100),
    meanPct: round(mu * 100, 3),
    volAnnPct: round(sd * Math.sqrt(periodsPerYear) * 100),
    sharpe: sd ? round((mu / sd) * Math.sqrt(periodsPerYear)) : 0,
    skew: sd ? round(m3 / sd ** 3) : 0,
    excessKurtosis: sd ? round(m4 / sd ** 4 - 3) : 0,
    maxDrawdownPct: round(mdd * 100),
    var95Pct: round(q(0.05) * 100),
    bestPct: round((sorted[n - 1] ?? 0) * 100),
    worstPct: round((sorted[0] ?? 0) * 100),
    positivePct: n ? Math.round((r.filter((x) => x > 0).length / n) * 100) : 0,
    histogram: hist.map((count, i) => ({ fromPct: round((lo + i * w) * 100, 3), count })),
  };
}

// ───────────── Regression / beta (RBA2) ─────────────

export function regression(y: number[], x: number[], periodsPerYear = 252): RegressionStats {
  const ry = y.slice(1).map((v, i) => (v - y[i]) / y[i]);
  const rx = x.slice(1).map((v, i) => (v - x[i]) / x[i]);
  const n = Math.min(ry.length, rx.length);
  const a = ry.slice(-n);
  const b = rx.slice(-n);
  const mx = mean(b);
  const my = mean(a);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (b[i] - mx) * (a[i] - my);
    sxx += (b[i] - mx) ** 2;
    syy += (a[i] - my) ** 2;
  }
  const beta = sxx ? sxy / sxx : 0;
  const corr = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  const condBeta = (pick: (v: number) => boolean) => {
    const idx = b.map((v, i) => (pick(v) ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 5) return null;
    const xs = idx.map((i) => b[i]);
    const ys = idx.map((i) => a[i]);
    const mxx = mean(xs);
    const myy = mean(ys);
    let num = 0;
    let den = 0;
    xs.forEach((v, k) => {
      num += (v - mxx) * (ys[k] - myy);
      den += (v - mxx) ** 2;
    });
    return den ? round(num / den, 3) : null;
  };
  const resid = a.map((v, i) => v - (my - beta * mx) - beta * b[i]);
  return {
    n,
    beta: round(beta, 3),
    alphaAnnPct: round((my - beta * mx) * periodsPerYear * 100),
    correlation: round(corr, 3),
    rSquared: round(corr * corr, 3),
    upBeta: condBeta((v) => v > 0),
    downBeta: condBeta((v) => v < 0),
    trackingErrorPct: round(stdev(resid) * Math.sqrt(periodsPerYear) * 100),
    points: a.slice(-250).map((v, i) => ({ x: round(b[b.length - Math.min(250, n) + i] * 100, 3), y: round(v * 100, 3) })),
  };
}

// ───────────── Ratio (ARR) ─────────────

export function ratioStats(a: number[], b: number[]): RatioStats {
  const ratio = a.map((v, i) => v / b[i]).filter((v) => isFinite(v));
  const cur = last(ratio);
  const mu = mean(ratio);
  const sd = stdev(ratio);
  const pct = Math.round((ratio.filter((v) => v <= cur).length / ratio.length) * 100);
  const r252 = ratio.slice(-252);
  return {
    current: round(cur, 6),
    mean: round(mu, 6),
    zScore: sd ? round((cur - mu) / sd) : 0,
    percentile: pct,
    min: round(Math.min(...ratio), 6),
    max: round(Math.max(...ratio), 6),
    change1yPct: r252.length > 1 ? round((cur / r252[0] - 1) * 100) : null,
    series: ratio,
  };
}

// ───────────── FX strength (FXS) ─────────────

/**
 * Strength of each currency over `n` bars from its USD-quoted series
 * (value of 1 unit in USD). Strength = own return − average return of all
 * currencies in the basket (USD included at 0). Pure.
 */
export function fxStrength(usdValues: Record<string, number[]>, n: number): { ccy: string; strength: number; returnPct: number }[] {
  const ret: Record<string, number> = { USD: 0 };
  for (const [ccy, s] of Object.entries(usdValues)) {
    if (s.length > n) ret[ccy] = (last(s) / s[s.length - 1 - n] - 1) * 100;
  }
  const avg = mean(Object.values(ret));
  return Object.entries(ret)
    .map(([ccy, r]) => ({ ccy, strength: round(r - avg, 3), returnPct: round(r, 3) }))
    .sort((x, y) => y.strength - x.strength);
}

// ───────────── Relative rotation (ROT) ─────────────

/**
 * Relative-rotation coordinates (JdK-style approximation):
 *   rs        = asset / benchmark
 *   rsRatio   = 100 × rs / SMA(rs, 50)               (relative trend)
 *   rsMomentum= 100 × rsRatio / rsRatio[t − 10]      (change in relative trend)
 * Quadrants: leading (≥100, ≥100), weakening (≥100, <100),
 * lagging (<100, <100), improving (<100, ≥100). Returns a short tail.
 */
export function rrg(asset: number[], bench: number[], tail = 8): RrgPoint[] {
  const rs = asset.map((v, i) => v / bench[i]);
  const base = sma(rs, 50);
  const ratio = rs.map((v, i) => (base[i] ? (100 * v) / base[i]! : null));
  const pts: RrgPoint[] = [];
  for (let i = Math.max(10, rs.length - tail * 5); i < rs.length; i += 5) {
    const r = ratio[i];
    const r0 = ratio[i - 10];
    if (r == null || r0 == null) continue;
    const m = (100 * r) / r0;
    pts.push({ rsRatio: round(r, 2), rsMomentum: round(m, 2), quadrant: r >= 100 ? (m >= 100 ? 'leading' : 'weakening') : m >= 100 ? 'improving' : 'lagging' });
  }
  return pts.slice(-tail);
}

// ───────────── Breadth (BRD) ─────────────

export function breadth(series: number[][]): BreadthStats {
  let above50 = 0;
  let above200 = 0;
  let adv = 0;
  let dec = 0;
  let highs = 0;
  let lows = 0;
  let n200 = 0;
  for (const s of series) {
    if (s.length < 2) continue;
    const px = last(s);
    const s50 = lastNum(sma(s, 50));
    const s200 = lastNum(sma(s, 200));
    if (s50 != null && px > s50) above50++;
    if (s200 != null) {
      n200++;
      if (px > s200) above200++;
    }
    const chg = px - s[s.length - 2];
    if (chg > 0) adv++;
    else if (chg < 0) dec++;
    const yr = s.slice(-252);
    if (px >= Math.max(...yr)) highs++;
    if (px <= Math.min(...yr)) lows++;
  }
  const total = series.filter((s) => s.length >= 2).length;
  return {
    members: total,
    advancers: adv,
    decliners: dec,
    pctAbove50: total ? Math.round((above50 / total) * 100) : 0,
    pctAbove200: n200 ? Math.round((above200 / n200) * 100) : 0,
    newHighs: highs,
    newLows: lows,
  };
}

// ───────────── Portfolio simulator (PTS) ─────────────

/**
 * Backtest fixed target weights on aligned daily closes. `rebalanceEvery`
 * in trading days (0 = buy & hold). Returns equity curve + stats. Pure.
 */
export function simulatePortfolio(closes: number[][], weights: number[], capital = 100_000_000, rebalanceEvery = 21, bench?: number[], periodsPerYear = 252): PortfolioResult {
  const n = closes[0]?.length ?? 0;
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const w = weights.map((x) => x / wsum);
  let units = w.map((wi, j) => (capital * wi) / closes[j][0]);
  const equity: number[] = [];
  for (let t = 0; t < n; t++) {
    const value = units.reduce((s, u, j) => s + u * closes[j][t], 0);
    equity.push(value);
    if (rebalanceEvery > 0 && t > 0 && t % rebalanceEvery === 0) units = w.map((wi, j) => (value * wi) / closes[j][t]);
  }
  const stats = seriesStats(equity, periodsPerYear);
  const benchStats = bench && bench.length === n ? seriesStats(bench.map((v) => (v / bench[0]) * capital), periodsPerYear) : null;
  const step = Math.max(1, Math.floor(n / 260));
  return {
    finalValue: Math.round(last(equity) ?? capital),
    stats,
    benchmark: benchStats,
    curve: equity.filter((_, i) => i % step === 0 || i === n - 1).map((v) => Math.round(v)),
    benchCurve: bench && bench.length === n ? bench.filter((_, i) => i % step === 0 || i === n - 1).map((v) => Math.round((v / bench[0]) * capital)) : undefined,
  };
}

/** Percentile rank (0–100) of the last value within the series. */
export function percentileOfLast(xs: number[]): number {
  const v = xs.filter((x) => isFinite(x));
  if (!v.length) return 50;
  const cur = last(v);
  return Math.round((v.filter((x) => x <= cur).length / v.length) * 100);
}
