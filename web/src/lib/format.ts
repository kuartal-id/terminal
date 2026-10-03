/** Number/time formatting. Pure — covered by tests in format.test.ts. */

export function decimalsFor(price: number, currency?: string): number {
  if (currency === 'IDR' && price >= 50) return 0;
  const a = Math.abs(price);
  if (a >= 1000) return 2;
  if (a >= 10) return 2;
  if (a >= 1) return 3;
  if (a >= 0.01) return 4;
  return 6;
}

export function fmtPrice(price: number | undefined | null, currency?: string): string {
  if (price == null || !isFinite(price)) return '—';
  const d = decimalsFor(price, currency);
  return price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtNum(v: number | undefined | null, digits = 2): string {
  if (v == null || !isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number | undefined | null, digits = 2, sign = true): string {
  if (v == null || !isFinite(v)) return '—';
  return `${sign && v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

/** Format an absolute change using the decimals of the reference price (so USD/IDR +8 not +8.000). */
export function fmtChange(v: number | undefined | null, currency?: string, refPrice?: number): string {
  if (v == null || !isFinite(v)) return '—';
  const d = decimalsFor(refPrice ?? v, currency);
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s}`;
}

export function fmtCompact(v: number | undefined | null): string {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [n, u] of units) if (a >= n) return `${(v / n).toFixed(a / n >= 100 ? 0 : a / n >= 10 ? 1 : 2)}${u}`;
  return v.toFixed(0);
}

export function dirClass(v: number | undefined | null): 'up' | 'down' | 'flat' {
  if (v == null || !isFinite(v) || Math.abs(v) < 1e-9) return 'flat';
  return v > 0 ? 'up' : 'down';
}

/** "14:05" if today, "3 Oct" otherwise, in the user's local zone. */
export function fmtTimeShort(iso: string | number, now = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function timeAgo(iso: string | number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Background colour for a heatmap tile given % change, using CSS vars. */
export function heatColor(pct: number): string {
  const a = Math.min(1, Math.abs(pct) / 4);
  const alpha = 0.25 + a * 0.65;
  return pct >= 0 ? `rgba(31, 134, 66, ${alpha})` : `rgba(196, 52, 52, ${alpha})`;
}
