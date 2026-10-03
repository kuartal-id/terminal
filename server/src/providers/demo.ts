import type { Candle, FxBoard, MacroSeries, NewsItem, YieldCurve } from '../../../shared/types';
import { seededRandom } from '../../../shared/math';
import { MACRO_COUNTRIES, MACRO_INDICATORS } from './official';

/**
 * DEMO DATA — synthetic, deterministic, and ALWAYS labelled `source: "demo"`
 * in API responses (the UI shows a DEMO badge). Used only when an upstream is
 * unreachable or DATA_MODE=demo. Never present this as real market data.
 */

/** Rough price anchors so demo screens look plausible. Not real prices. */
const ANCHORS: Record<string, number> = {
  '^JKSE': 7150, '^JKLQ45': 820, 'IDR=X': 17540, EIDO: 19.2,
  '^N225': 38200, '^HSI': 24900, '000001.SS': 3550, '^STI': 4050, '^KLSE': 1610, '^SET.BK': 1280, 'PSEI.PS': 6300, '^KS11': 3150, '^AXJO': 8650,
  '^GSPC': 7597, '^IXIC': 25400, '^DJI': 46200, '^RUT': 2390, '^VIX': 21.5, '^FTSE': 9150, '^GDAXI': 23800, '^STOXX50E': 5400,
  'DX-Y.NYB': 99.1, 'EURUSD=X': 1.161, 'JPY=X': 154.3, 'CNY=X': 6.71, 'SGD=X': 1.31, 'AUDUSD=X': 0.716, 'GBPUSD=X': 1.35,
  'GC=F': 4343, 'SI=F': 52.4, 'BZ=F': 103.2, 'CL=F': 100.1, 'NG=F': 3.6, 'HG=F': 5.05, 'MTF=F': 112,
  '^IRX': 4.05, '^FVX': 4.42, '^TNX': 4.83, '^TYX': 5.35,
  BTCUSDT: 76823, ETHUSDT: 3150, SOLUSDT: 168, BNBUSDT: 706, XRPUSDT: 2.35, PAXGUSDT: 4340, DOGEUSDT: 0.21, ADAUSDT: 0.78, AVAXUSDT: 26.4, LINKUSDT: 17.2, TONUSDT: 3.1,
  'BBCA.JK': 6325, 'BBRI.JK': 3270, 'BMRI.JK': 4360, 'BBNI.JK': 3750, 'BBTN.JK': 1175, 'ARTO.JK': 1015, 'TLKM.JK': 2600,
  'EXCL.JK': 2630, 'ISAT.JK': 2430, 'TOWR.JK': 454, 'UNVR.JK': 1630, 'ICBP.JK': 7125, 'INDF.JK': 7300, 'MAPI.JK': 1340,
  'AMRT.JK': 1255, 'CPIN.JK': 3160, 'KLBF.JK': 735, 'ASII.JK': 4910, 'MDKA.JK': 3050, 'INCO.JK': 4830, 'PTBA.JK': 3100,
  'AADI.JK': 12225, 'ANTM.JK': 2950, 'GOTO.JK': 68, 'ADRO.JK': 2150, 'UNTR.JK': 24500, 'AMMN.JK': 7800, 'BRIS.JK': 2700,
  'ITMG.JK': 23500, 'MEDC.JK': 1250, 'PGAS.JK': 1650, 'SMGR.JK': 2900, 'JSMR.JK': 4200, 'AKRA.JK': 1200, 'ACES.JK': 640,
};

const VOL: Record<string, number> = { crypto: 0.035, equity: 0.018, index: 0.01, fx: 0.004, commodity: 0.017, rate: 0.02 };

function volFor(symbol: string): number {
  if (/USDT$/.test(symbol)) return VOL.crypto;
  if (/=X$|DX-Y/.test(symbol)) return VOL.fx;
  if (/=F$/.test(symbol)) return VOL.commodity;
  if (/^\^(IRX|FVX|TNX|TYX)$/.test(symbol)) return VOL.rate;
  if (symbol.startsWith('^') || symbol.includes('.SS') || symbol.includes('.PS')) return VOL.index;
  return VOL.equity;
}

export function demoAnchor(symbol: string): number {
  if (ANCHORS[symbol]) return ANCHORS[symbol];
  const r = seededRandom(symbol);
  return symbol.endsWith('.JK') ? Math.round(200 + r() * 9000) : Math.round(10 + r() * 400);
}

/** Daily candles ending today, deterministic per symbol+day. */
export function demoCandles(symbol: string, count = 260, stepSec = 86400): Candle[] {
  const today = Math.floor(Date.now() / 1000 / stepSec) * stepSec;
  const rnd = seededRandom(`${symbol}:${today}:${stepSec}`);
  const vol = volFor(symbol) * Math.sqrt(stepSec / 86400);
  const anchor = demoAnchor(symbol);
  // Walk backwards from the anchor so the last close ≈ anchor.
  const closes: number[] = [anchor];
  for (let i = 1; i < count; i++) {
    const shock = (rnd() - 0.5) * 2 * vol + Math.sin(i / 17) * vol * 0.15;
    closes.unshift(closes[0] / (1 + shock));
  }
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const close = closes[i];
    const open = i === 0 ? close * (1 + (rnd() - 0.5) * vol) : closes[i - 1];
    const high = Math.max(open, close) * (1 + rnd() * vol * 0.6);
    const low = Math.min(open, close) * (1 - rnd() * vol * 0.6);
    const tick = close > 1000 ? 1 : close > 10 ? 0.01 : 0.0001;
    const r = (v: number) => Math.round(v / tick) * tick;
    candles.push({ time: today - (count - 1 - i) * stepSec, open: r(open), high: r(high), low: r(low), close: r(close), volume: Math.round(1e5 + rnd() * 5e7) });
  }
  return candles;
}

export function demoNews(): NewsItem[] {
  const now = Date.now();
  const items: [string, string, 'id' | 'global', string[]][] = [
    ['Demo headline: Rupiah steadies as Bank Indonesia signals readiness to intervene', 'Kuartal Demo', 'id', ['economy']],
    ['Demo headline: IHSG closes mixed; banks weigh, miners lift index', 'Kuartal Demo', 'id', ['markets', 'idx']],
    ['Demo headline: Foreign investors net buyers in big-cap banks this week', 'Kuartal Demo', 'id', ['markets', 'idx']],
    ['Demo headline: Coal prices extend gains on Asian demand', 'Kuartal Demo', 'global', ['markets']],
    ['Demo headline: Fed officials split on timing of next move', 'Kuartal Demo', 'global', ['central-banks', 'rates']],
    ['Demo headline: Treasury yields climb after strong data', 'Kuartal Demo', 'global', ['rates']],
    ['Demo headline: Bitcoin volatility returns as ETF flows swing', 'Kuartal Demo', 'global', ['crypto']],
    ['Demo headline: ECB keeps policy unchanged, flags inflation risks', 'Kuartal Demo', 'global', ['central-banks']],
  ];
  return items.map(([title, source, region, topics], i) => ({
    id: `demo-${i}`,
    title,
    url: 'https://terminal.kuartalsystems.com/#demo',
    source,
    published: new Date(now - i * 47 * 60000).toISOString(),
    region,
    topics,
  }));
}

export function demoFx(): FxBoard {
  const base: Record<string, number> = { IDR: 17540, EUR: 0.861, JPY: 154.3, GBP: 0.741, CNY: 6.71, SGD: 1.31, MYR: 4.21, THB: 32.4, PHP: 57.9, AUD: 1.397, INR: 87.6, KRW: 1385, CHF: 0.81, CAD: 1.37, HKD: 7.79 };
  const r = seededRandom('fx-prior');
  const prior: Record<string, number> = {};
  for (const [k, v] of Object.entries(base)) prior[k] = v * (1 + (r() - 0.5) * 0.04);
  const today = new Date().toISOString().slice(0, 10);
  return { base: 'USD', date: today, rates: base, prior: { date: today, rates: prior } };
}

export function demoCurve(): YieldCurve {
  const tenors: [string, number, number][] = [['1M', 1, 4.12], ['3M', 3, 4.08], ['6M', 6, 4.02], ['1Y', 12, 3.95], ['2Y', 24, 3.98], ['3Y', 36, 4.06], ['5Y', 60, 4.29], ['7Y', 84, 4.52], ['10Y', 120, 4.83], ['20Y', 240, 5.28], ['30Y', 360, 5.35]];
  const date = new Date().toISOString().slice(0, 10);
  const shift = (d: number) => tenors.map(([tenor, months, v]) => ({ tenor, months, value: +(v - d * (1 - months / 400)).toFixed(2) }));
  return { date, points: shift(0), compare: [{ label: '1M ago', date, points: shift(0.12) }, { label: '1Y ago', date, points: shift(0.55) }] };
}

export function demoMacro(indicator: string, countries: string[], from: number, to: number): MacroSeries[] {
  return countries.map((c) => {
    const r = seededRandom(`${indicator}:${c}`);
    const base = indicator.includes('GDP.MKTP') ? 2 + r() * 4 : indicator.includes('CPI') ? 1.5 + r() * 4 : 3 + r() * 6;
    const points = [];
    for (let y = from; y <= Math.min(to, new Date().getFullYear() - 1); y++) points.push({ year: y, value: +(base + (r() - 0.5) * 3).toFixed(2) });
    return { country: c, countryName: MACRO_COUNTRIES[c] ?? c, indicator, indicatorName: MACRO_INDICATORS[indicator] ?? indicator, points };
  });
}
