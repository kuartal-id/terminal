import type { DataSource, Envelope } from '../../../shared/types';
import type { MacroDashboard, MacroGauge, MacroPoint, MacroSeriesOut } from '../../../shared/research';
import { seededRandom } from '../../../shared/math';
import { cache, mapLimit } from '../cache';
import { combineOn, diff, fredSeries, momAnnualised, yoy, type FredSeriesDef } from '../providers/fred';
import { worstSource } from './market';

/**
 * US macro dashboards built from public-domain FRED series. Each topic is a
 * list of series plus (optionally) a transparent composite gauge. Gauges are
 * descriptive conditions, never forecasts or trade signals.
 */

type Def = FredSeriesDef & { lag?: number };

export const TOPICS: Record<string, { title: string; series: Def[] }> = {
  'real-yields': {
    title: 'US Real Yields',
    series: [
      { id: 'DFII5', name: '5Y TIPS real yield', units: '%', frequency: 'daily' },
      { id: 'DFII10', name: '10Y TIPS real yield', units: '%', frequency: 'daily' },
      { id: 'DFII30', name: '30Y TIPS real yield', units: '%', frequency: 'daily' },
      { id: 'T10YIE', name: '10Y breakeven inflation', units: '%', frequency: 'daily' },
      { id: 'T5YIFR', name: '5Y5Y forward inflation', units: '%', frequency: 'daily' },
    ],
  },
  liquidity: {
    title: 'Fed Net Liquidity',
    series: [
      { id: 'WALCL', name: 'Fed total assets', units: '$bn', frequency: 'weekly', transform: 'k-to-m' },
      { id: 'WTREGEN', name: 'Treasury General Account', units: '$bn', frequency: 'weekly', transform: 'k-to-m' },
      { id: 'RRPONTSYD', name: 'Overnight reverse repo', units: '$bn', frequency: 'daily' },
      { id: 'WRESBAL', name: 'Bank reserves', units: '$bn', frequency: 'weekly' },
      { id: 'M2SL', name: 'M2 money supply (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
    ],
  },
  recession: {
    title: 'Recession Probability',
    series: [
      { id: 'SAHMREALTIME', name: 'Sahm rule (real-time)', units: 'pp', frequency: 'monthly' },
      { id: 'T10Y3M', name: '10Y − 3M Treasury spread', units: 'pp', frequency: 'daily' },
      { id: 'T10Y2Y', name: '10Y − 2Y Treasury spread', units: 'pp', frequency: 'daily' },
      { id: 'UNRATE', name: 'Unemployment rate', units: '%', frequency: 'monthly' },
      { id: 'ICSA', name: 'Initial jobless claims', units: 'k', frequency: 'weekly', transform: 'k-to-m' },
      { id: 'USREC', name: 'NBER recession indicator', units: '0/1', frequency: 'monthly' },
    ],
  },
  employment: {
    title: 'Employment Data',
    series: [
      { id: 'PAYEMS', name: 'Nonfarm payrolls (monthly change)', units: 'k', frequency: 'monthly', transform: 'diff12', lag: 1 },
      { id: 'UNRATE', name: 'Unemployment rate', units: '%', frequency: 'monthly' },
      { id: 'ICSA', name: 'Initial jobless claims', units: 'k', frequency: 'weekly', transform: 'k-to-m' },
      { id: 'CIVPART', name: 'Labour force participation', units: '%', frequency: 'monthly' },
      { id: 'CES0500000003', name: 'Average hourly earnings (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'JTSJOL', name: 'Job openings (JOLTS)', units: 'k', frequency: 'monthly' },
    ],
  },
  inflation: {
    title: 'Inflation Data',
    series: [
      { id: 'CPIAUCSL', name: 'CPI (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'CPILFESL', name: 'Core CPI (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'PCEPILFE', name: 'Core PCE (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'CPILFESL', name: 'Core CPI (3M annualised)', units: '%', frequency: 'monthly', transform: 'mom-ann' },
      { id: 'T5YIFR', name: '5Y5Y forward inflation', units: '%', frequency: 'daily' },
    ],
  },
  funding: {
    title: 'Dollar Funding Stress',
    series: [
      { id: 'SOFR', name: 'SOFR', units: '%', frequency: 'daily' },
      { id: 'IORB', name: 'Interest on reserve balances', units: '%', frequency: 'daily' },
      { id: 'SOFR99', name: 'SOFR 99th percentile', units: '%', frequency: 'daily' },
      { id: 'RRPONTSYD', name: 'Overnight reverse repo', units: '$bn', frequency: 'daily' },
      { id: 'RPONTSYD', name: 'Fed repo operations (standing repo)', units: '$bn', frequency: 'daily' },
    ],
  },
  fiscal: {
    title: 'Fiscal Data',
    series: [
      { id: 'MTSDS133FMS', name: 'Monthly federal surplus/deficit', units: '$bn', frequency: 'monthly', transform: 'k-to-m' },
      { id: 'GFDEBTN', name: 'Federal debt, total public', units: '$bn', frequency: 'quarterly', transform: 'k-to-m' },
      { id: 'GFDEGDQ188S', name: 'Federal debt (% of GDP)', units: '%', frequency: 'quarterly' },
      { id: 'A091RC1Q027SBEA', name: 'Federal interest payments (SAAR)', units: '$bn', frequency: 'quarterly' },
    ],
  },
  growth: {
    title: 'Economic Growth',
    series: [
      { id: 'A191RL1Q225SBEA', name: 'Real GDP growth (q/q SAAR)', units: '%', frequency: 'quarterly' },
      { id: 'GDPNOW', name: 'Atlanta Fed GDPNow nowcast', units: '%', frequency: 'quarterly' },
      { id: 'INDPRO', name: 'Industrial production (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'RSAFS', name: 'Retail sales (YoY)', units: '%', frequency: 'monthly', transform: 'yoy', lag: 12 },
      { id: 'PAYEMS', name: 'Nonfarm payrolls (monthly change)', units: 'k', frequency: 'monthly', transform: 'diff12', lag: 1 },
    ],
  },
};

const YEARS: Record<FredSeriesDef['frequency'], number> = { daily: 3, weekly: 5, monthly: 12, quarterly: 15, annual: 30 };
const PER_YEAR: Record<FredSeriesDef['frequency'], number> = { daily: 252, weekly: 52, monthly: 12, quarterly: 4, annual: 1 };

function startDate(def: Def): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - YEARS[def.frequency] - (def.transform === 'yoy' ? 1 : 0));
  return d.toISOString().slice(0, 10);
}

/** Apply a series' transform. Pure. */
export function transform(def: Def, pts: MacroPoint[]): MacroPoint[] {
  switch (def.transform) {
    case 'yoy':
      return yoy(pts, def.lag ?? PER_YEAR[def.frequency]);
    case 'mom-ann': {
      // 3-month annualised: compound of the last 3 monthly changes.
      const m = momAnnualised(pts);
      return m.slice(2).map((p, i) => ({ date: p.date, value: Number((((1 + m[i].value / 100) * (1 + m[i + 1].value / 100) * (1 + p.value / 100)) ** (1 / 3) * 100 - 100).toFixed(2)) }));
    }
    case 'diff12':
      return diff(pts, def.lag ?? 12);
    case 'k-to-m':
      return pts.map((p) => ({ date: p.date, value: Number((p.value / 1000).toFixed(2)) }));
    default:
      return pts;
  }
}

/** Summarise a transformed series for the UI. Pure. */
export function summarise(def: Def, pts: MacroPoint[]): MacroSeriesOut {
  const latest = pts[pts.length - 1] ?? null;
  const previous = pts[pts.length - 2] ?? null;
  const yearAgo = pts.length > PER_YEAR[def.frequency] ? pts[pts.length - 1 - PER_YEAR[def.frequency]].value : null;
  // Keep payloads small: daily series thinned to ~2 points a week.
  const step = def.frequency === 'daily' ? 2 : 1;
  return {
    id: def.id,
    name: def.name,
    units: def.units,
    frequency: def.frequency,
    latest,
    previous,
    change: latest && previous ? Number((latest.value - previous.value).toFixed(3)) : null,
    yearAgo,
    points: pts.filter((_, i) => i % step === 0 || i === pts.length - 1),
  };
}

/** Clearly-labelled demo series when FRED is unreachable. */
function demoPoints(def: Def): MacroPoint[] {
  const rnd = seededRandom(def.id + (def.transform ?? ''));
  const base: Record<string, number> = { '%': 3, pp: 0.4, $bn: 4000, k: 220, '0/1': 0 };
  const n = Math.min(260, YEARS[def.frequency] * PER_YEAR[def.frequency]);
  const stepDays = 365 / PER_YEAR[def.frequency];
  let v = base[def.units] ?? 1;
  const out: MacroPoint[] = [];
  for (let i = 0; i < n; i++) {
    v = def.units === '0/1' ? 0 : v * (1 + (rnd() - 0.5) * 0.02) + (def.units === '%' || def.units === 'pp' ? (rnd() - 0.5) * 0.05 : 0);
    out.push({ date: new Date(Date.now() - (n - i) * stepDays * 86400_000).toISOString().slice(0, 10), value: Number(v.toFixed(3)) });
  }
  return out;
}

async function loadSeries(def: Def): Promise<{ out: MacroSeriesOut; raw: MacroPoint[]; source: DataSource }> {
  return cache.get(`fred:${def.id}:${def.transform ?? ''}`, 6 * 3600_000, async () => {
    try {
      const raw = await fredSeries(def.id, startDate(def));
      return { out: summarise(def, transform(def, raw)), raw, source: 'eod' as DataSource };
    } catch {
      const raw = demoPoints(def);
      return { out: summarise(def, transform(def, raw)), raw, source: 'demo' as DataSource };
    }
  });
}

// ───────────── Gauges (pure) ─────────────

const lastVal = (p: MacroPoint[]) => p[p.length - 1]?.value;
const clamp100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

/** Dollar funding stress: SOFR−IORB, tail dispersion (SOFR99−SOFR), Fed repo usage, RRP buffer. */
export function fundingGauge(s: Record<string, MacroPoint[]>): MacroGauge {
  const sofr = lastVal(s.SOFR) ?? 0;
  const iorb = lastVal(s.IORB) ?? sofr;
  const p99 = lastVal(s.SOFR99) ?? sofr;
  const rrp = lastVal(s.RRPONTSYD) ?? 500;
  const repo = lastVal(s.RPONTSYD) ?? 0;
  const spreadBp = (sofr - iorb) * 100;
  const tailBp = (p99 - sofr) * 100;
  // Each component 0–100: SOFR at/above IORB is tight; a 10bp+ tail is stressed;
  // any standing-repo take-up signals demand for cash; RRP < $100bn means the buffer is gone.
  const c1 = clamp100(50 + spreadBp * 5);
  const c2 = clamp100(tailBp * 8);
  const c3 = clamp100(repo > 0 ? 40 + Math.log10(1 + repo) * 25 : 0);
  const c4 = clamp100(rrp < 100 ? 70 : rrp < 300 ? 40 : 10);
  const score = clamp100(c1 * 0.35 + c2 * 0.25 + c3 * 0.25 + c4 * 0.15);
  return {
    score,
    label: score >= 65 ? 'Stressed' : score >= 40 ? 'Tightening' : 'Calm',
    explain: [
      `SOFR − IORB: ${spreadBp.toFixed(1)} bp (${spreadBp >= 0 ? 'repo trading at/above the reserve rate' : 'below the reserve rate'})`,
      `Tail dispersion (SOFR 99th pct − SOFR): ${tailBp.toFixed(1)} bp`,
      `Fed standing repo take-up: $${repo.toFixed(1)}bn`,
      `Reverse repo buffer: $${rrp.toFixed(0)}bn`,
    ],
  };
}

/** Recession risk conditions: Sahm rule, curve inversion, claims trend, unemployment drift. */
export function recessionGauge(s: Record<string, MacroPoint[]>): MacroGauge {
  const sahm = lastVal(s.SAHMREALTIME) ?? 0;
  const t3m = lastVal(s.T10Y3M) ?? 1;
  const claims = s.ICSA ?? [];
  const c4 = claims.slice(-4).reduce((a, p) => a + p.value, 0) / Math.max(1, Math.min(4, claims.length));
  const c26 = claims.slice(-30, -26).reduce((a, p) => a + p.value, 0) / 4 || c4;
  const claimsChg = c26 ? ((c4 - c26) / c26) * 100 : 0;
  const un = s.UNRATE ?? [];
  const unLow = Math.min(...un.slice(-12).map((p) => p.value));
  const unDrift = (lastVal(un) ?? unLow) - unLow;
  // Months the 10Y−3M curve has been inverted in the last 24 months (daily → approx).
  const inverted = (s.T10Y3M ?? []).slice(-500).filter((p) => p.value < 0).length / 21;
  const parts = [clamp100((sahm / 0.5) * 60), clamp100(t3m < 0 ? 50 + Math.min(50, -t3m * 50) : Math.max(0, 30 - t3m * 20)), clamp100(claimsChg * 3), clamp100(unDrift * 80)];
  const score = clamp100(parts[0] * 0.35 + parts[1] * 0.25 + parts[2] * 0.2 + parts[3] * 0.2);
  return {
    score,
    label: score >= 60 ? 'Elevated risk' : score >= 35 ? 'Watch' : 'Low risk',
    explain: [
      `Sahm rule: ${sahm.toFixed(2)} pp (${sahm >= 0.5 ? 'triggered (≥0.50)' : 'not triggered'})`,
      `10Y − 3M spread: ${t3m.toFixed(2)} pp${inverted > 0 ? `, inverted ~${Math.round(inverted)} of the last 24 months` : ''}`,
      `Initial claims, 4-wk avg vs 6 months ago: ${claimsChg >= 0 ? '+' : ''}${claimsChg.toFixed(1)}%`,
      `Unemployment ${unDrift.toFixed(1)} pp above its 12-month low`,
    ],
  };
}

/** Net liquidity = Fed assets − TGA − RRP (all $bn), with 4- and 13-week change. */
export function netLiquidity(s: Record<string, MacroPoint[]>): { points: MacroPoint[]; gauge: MacroGauge } {
  const pts = combineOn(s.WALCL ?? [], [s.WTREGEN ?? [], s.RRPONTSYD ?? []], (a, [tga, rrp]) => a - tga - rrp);
  const cur = lastVal(pts) ?? 0;
  const w4 = pts.length > 4 ? cur - pts[pts.length - 5].value : 0;
  const w13 = pts.length > 13 ? cur - pts[pts.length - 14].value : 0;
  const score = clamp100(50 + (w13 / Math.max(1, cur)) * 100 * 10);
  return {
    points: pts,
    gauge: {
      score,
      label: w4 > 0 && w13 > 0 ? 'Expanding' : w4 < 0 && w13 < 0 ? 'Contracting' : 'Turning',
      explain: [`Net liquidity: $${cur.toFixed(0)}bn`, `4-week change: ${w4 >= 0 ? '+' : ''}${w4.toFixed(0)}bn`, `13-week change: ${w13 >= 0 ? '+' : ''}${w13.toFixed(0)}bn`, 'Score: 50 = flat; higher = liquidity being added'],
    },
  };
}

export async function getMacroTopic(topic: string): Promise<Envelope<MacroDashboard>> {
  const t = TOPICS[topic];
  if (!t) throw new Error('unknown topic');
  const loaded = await mapLimit(t.series, 4, loadSeries);
  const byId: Record<string, MacroPoint[]> = {};
  t.series.forEach((d, i) => {
    if (!d.transform || d.transform === 'k-to-m') byId[d.id] = transform(d, loaded[i].raw);
  });
  const data: MacroDashboard = { topic, series: loaded.map((l) => l.out) };
  if (topic === 'funding') data.gauge = fundingGauge(byId);
  if (topic === 'recession') data.gauge = recessionGauge(byId);
  if (topic === 'liquidity') {
    const nl = netLiquidity(byId);
    data.gauge = nl.gauge;
    data.derived = [{ name: 'Net liquidity (assets − TGA − RRP)', units: '$bn', latest: nl.points[nl.points.length - 1] ?? null, points: nl.points }];
  }
  const source = worstSource(loaded.map((l) => l.source));
  // A gauge computed from demo numbers must not read like a real condition.
  if (source === 'demo' && data.gauge) data.gauge = { ...data.gauge, label: 'Demo data: not real conditions', explain: ['FRED was unreachable, so these readings come from illustrative demo series.'] };
  return {
    data,
    source,
    provider: source === 'demo' ? 'Kuartal demo generator (FRED unreachable)' : 'FRED, Federal Reserve Bank of St. Louis (public-domain series)',
    asOf: new Date().toISOString(),
    note: source === 'demo' ? 'Some or all series are DEMO data because FRED was unreachable.' : undefined,
  };
}
