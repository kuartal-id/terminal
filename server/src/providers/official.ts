import type { FxBoard, MacroSeries, YieldCurve, YieldPoint } from '../../../shared/types';
import { fetchJson, fetchText, UpstreamError } from '../http';

/**
 * Official / open-licence sources. All free, no key, and explicitly allowed
 * for reuse:
 *  - US Treasury daily par yield curve (US government public domain)
 *  - Frankfurter (ECB euro reference rates, open)
 *  - World Bank Open Data (CC BY 4.0 — attribution shown in the UI)
 */

// ───────────── US Treasury ─────────────

const TENOR_MONTHS: Record<string, number> = {
  '1 Mo': 1, '1.5 Month': 1.5, '2 Mo': 2, '3 Mo': 3, '4 Mo': 4, '6 Mo': 6,
  '1 Yr': 12, '2 Yr': 24, '3 Yr': 36, '5 Yr': 60, '7 Yr': 84, '10 Yr': 120, '20 Yr': 240, '30 Yr': 360,
};
const TENOR_LABEL: Record<string, string> = {
  '1 Mo': '1M', '1.5 Month': '6W', '2 Mo': '2M', '3 Mo': '3M', '4 Mo': '4M', '6 Mo': '6M',
  '1 Yr': '1Y', '2 Yr': '2Y', '3 Yr': '3Y', '5 Yr': '5Y', '7 Yr': '7Y', '10 Yr': '10Y', '20 Yr': '20Y', '30 Yr': '30Y',
};

export interface TreasuryRow {
  date: string; // YYYY-MM-DD
  points: YieldPoint[];
}

/** Parse Treasury's CSV (newest row first). Pure — unit tested. */
export function parseTreasuryCsv(csv: string): TreasuryRow[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsv(lines[0]);
  const rows: TreasuryRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line);
    const [m, d, y] = (cells[0] ?? '').split('/');
    if (!y) continue;
    const date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const points: YieldPoint[] = [];
    header.forEach((h, i) => {
      if (i === 0 || !(h in TENOR_MONTHS)) return;
      const v = parseFloat(cells[i]);
      if (isFinite(v)) points.push({ tenor: TENOR_LABEL[h], months: TENOR_MONTHS[h], value: v });
    });
    if (points.length) rows.push({ date, points });
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function treasuryUrl(year: number): string {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

export async function treasuryCurve(now = new Date()): Promise<YieldCurve> {
  const y = now.getUTCFullYear();
  const [thisYear, lastYear] = await Promise.all([
    fetchText(treasuryUrl(y)).then(parseTreasuryCsv),
    fetchText(treasuryUrl(y - 1)).then(parseTreasuryCsv).catch(() => [] as TreasuryRow[]),
  ]);
  const rows = [...thisYear, ...lastYear];
  if (!rows.length) throw new UpstreamError('treasury: no rows');
  return buildCurve(rows);
}

/** Pick latest, ~1 month ago and ~1 year ago from a set of rows. Pure. */
export function buildCurve(rows: TreasuryRow[]): YieldCurve {
  const latest = rows[0];
  const at = (daysBack: number) => {
    const target = new Date(latest.date);
    target.setUTCDate(target.getUTCDate() - daysBack);
    const t = target.toISOString().slice(0, 10);
    return rows.find((r) => r.date <= t);
  };
  const compare: YieldCurve['compare'] = [];
  const m1 = at(30);
  const y1 = at(365);
  if (m1) compare.push({ label: '1M ago', date: m1.date, points: m1.points });
  if (y1) compare.push({ label: '1Y ago', date: y1.date, points: y1.points });
  return { date: latest.date, points: latest.points, compare };
}

// ───────────── Frankfurter (ECB) ─────────────

interface RawFx {
  base: string;
  date: string;
  rates: Record<string, number>;
}

const FX_HOSTS = ['https://api.frankfurter.dev/v1', 'https://api.frankfurter.app'];

async function frankfurter(path: string): Promise<RawFx> {
  let lastErr: unknown;
  for (const h of FX_HOSTS) {
    try {
      return await fetchJson<RawFx>(`${h}${path}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new UpstreamError('frankfurter failed');
}

export async function fxBoard(base = 'USD'): Promise<FxBoard> {
  const latest = await frankfurter(`/latest?base=${base}`);
  const d = new Date(latest.date);
  d.setUTCDate(d.getUTCDate() - 30);
  const prior = await frankfurter(`/${d.toISOString().slice(0, 10)}?base=${base}`).catch(() => undefined);
  return { base: latest.base, date: latest.date, rates: latest.rates, prior: prior ? { date: prior.date, rates: prior.rates } : undefined };
}

// ───────────── World Bank ─────────────

export const MACRO_INDICATORS: Record<string, string> = {
  'NY.GDP.MKTP.KD.ZG': 'GDP growth (annual %)',
  'FP.CPI.TOTL.ZG': 'Inflation, consumer prices (annual %)',
  'SL.UEM.TOTL.ZS': 'Unemployment (% of labour force)',
  'BN.CAB.XOKA.GD.ZS': 'Current account balance (% of GDP)',
  'GC.DOD.TOTL.GD.ZS': 'Central government debt (% of GDP)',
  'NE.EXP.GNFS.ZS': 'Exports of goods & services (% of GDP)',
  'BX.KLT.DINV.WD.GD.ZS': 'FDI net inflows (% of GDP)',
  'NY.GDP.PCAP.CD': 'GDP per capita (current US$)',
  'FR.INR.LEND': 'Lending interest rate (%)',
  'PA.NUS.FCRF': 'Official exchange rate (LCU per US$)',
};

export const MACRO_COUNTRIES: Record<string, string> = {
  IDN: 'Indonesia', MYS: 'Malaysia', THA: 'Thailand', PHL: 'Philippines', VNM: 'Vietnam', SGP: 'Singapore',
  IND: 'India', CHN: 'China', JPN: 'Japan', KOR: 'South Korea', AUS: 'Australia', USA: 'United States',
  GBR: 'United Kingdom', DEU: 'Germany', BRA: 'Brazil', SAU: 'Saudi Arabia', ARE: 'United Arab Emirates', TUR: 'Turkiye',
};

interface RawWbRow {
  indicator: { id: string; value: string };
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

/** Pure — unit tested. Returns one series per country, oldest → newest. */
export function parseWorldBank(raw: unknown, indicator: string): MacroSeries[] {
  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) {
    const msg = Array.isArray(raw) ? JSON.stringify(raw[0]).slice(0, 120) : 'bad payload';
    throw new UpstreamError(`worldbank: ${msg}`);
  }
  const rows = raw[1] as RawWbRow[];
  const byCountry = new Map<string, MacroSeries>();
  for (const r of rows) {
    const iso = r.countryiso3code || r.country.id;
    let s = byCountry.get(iso);
    if (!s) {
      s = { country: iso, countryName: MACRO_COUNTRIES[iso] ?? r.country.value, indicator, indicatorName: MACRO_INDICATORS[indicator] ?? r.indicator.value, points: [] };
      byCountry.set(iso, s);
    }
    s.points.push({ year: Number(r.date), value: r.value });
  }
  for (const s of byCountry.values()) s.points.sort((a, b) => a.year - b.year);
  return [...byCountry.values()];
}

export async function worldBank(indicator: string, countries: string[], fromYear: number, toYear: number): Promise<MacroSeries[]> {
  const url = `https://api.worldbank.org/v2/country/${countries.join(';')}/indicator/${indicator}?format=json&per_page=2000&date=${fromYear}:${toYear}`;
  const raw = await fetchJson<unknown>(url, { timeoutMs: 12000 });
  return parseWorldBank(raw, indicator);
}
