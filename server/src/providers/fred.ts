import type { MacroPoint } from '../../../shared/research';
import { fetchText, UpstreamError } from '../http';

/**
 * FRED (Federal Reserve Bank of St. Louis) — the public "fredgraph.csv"
 * download, which needs no API key.
 *
 * Licence: we only use series whose underlying source is a US government
 * body (Federal Reserve Board, BLS, BEA, Treasury, Atlanta/NY Fed) — public
 * domain. Third-party copyrighted series on FRED (ICE BofA indices, Moody's,
 * S&P/Case-Shiller …) are deliberately NOT used. Keep it that way; see
 * docs/DATA_SOURCES.md.
 */

export interface FredSeriesDef {
  id: string;
  name: string;
  units: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  /** Optional transform applied to the raw series. */
  transform?: 'yoy' | 'mom-ann' | 'diff12' | 'k-to-m';
}

/** Parse fredgraph.csv (header "observation_date,ID" or legacy "DATE,ID"; "." = missing). Pure. */
export function parseFredCsv(csv: string): MacroPoint[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2 || !/date/i.test(lines[0])) throw new UpstreamError('FRED: unexpected CSV header');
  const out: MacroPoint[] = [];
  for (const line of lines.slice(1)) {
    const [date, raw] = line.split(',');
    const v = Number(raw);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || raw === '.' || raw === '' || !isFinite(v)) continue;
    out.push({ date, value: v });
  }
  if (!out.length) throw new UpstreamError('FRED: no observations');
  return out;
}

export async function fredSeries(id: string, startDate: string): Promise<MacroPoint[]> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}&cosd=${startDate}`;
  return parseFredCsv(await fetchText(url, { timeoutMs: 12_000 }));
}

/** Year-over-year % change for a series of known periodicity. Pure. */
export function yoy(points: MacroPoint[], periodsPerYear: number): MacroPoint[] {
  return points.slice(periodsPerYear).map((p, i) => ({ date: p.date, value: Number((((p.value / points[i].value) - 1) * 100).toFixed(2)) }));
}

/** Month-over-month change annualised (%), for monthly series. Pure. */
export function momAnnualised(points: MacroPoint[]): MacroPoint[] {
  return points.slice(1).map((p, i) => ({ date: p.date, value: Number(((((p.value / points[i].value) ** 12) - 1) * 100).toFixed(2)) }));
}

/** Change vs. the value one year earlier (for levels like payrolls). Pure. */
export function diff(points: MacroPoint[], lag: number): MacroPoint[] {
  return points.slice(lag).map((p, i) => ({ date: p.date, value: Number((p.value - points[i].value).toFixed(3)) }));
}

/**
 * Combine series on matching dates with `f` (e.g. net liquidity). Weekly
 * series (WALCL Wednesday, TGA Wednesday) are matched by date; a daily series
 * is sampled at the latest date ≤ each base date. Pure.
 */
export function combineOn(base: MacroPoint[], others: MacroPoint[][], f: (b: number, o: number[]) => number): MacroPoint[] {
  const idx = others.map(() => 0);
  const out: MacroPoint[] = [];
  for (const p of base) {
    const vals: number[] = [];
    let ok = true;
    others.forEach((s, k) => {
      while (idx[k] + 1 < s.length && s[idx[k] + 1].date <= p.date) idx[k]++;
      const v = s[idx[k]];
      if (!v || v.date > p.date) ok = false;
      else vals.push(v.value);
    });
    if (ok) out.push({ date: p.date, value: Number(f(p.value, vals).toFixed(3)) });
  }
  return out;
}
