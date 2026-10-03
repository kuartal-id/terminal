import { useEffect, useMemo, useState } from 'react';
import type { Envelope, FxBoard, Quote } from '@shared/types';
import { LQ45 } from '@shared/instruments';
import { useApi } from '../lib/api';
import { dirClass, fmtCompact, fmtNum, fmtPct, fmtPrice, heatColor } from '../lib/format';
import { SECTORS } from '../lib/sectors';
import { useStore } from '../lib/store';
import { ErrorBox, Loading, Sparkline } from '../components/bits';
import type { PanelProps } from './types';

// ───────────── IDX · IDX Movers ─────────────

type SortKey = 'label' | 'price' | 'changePct' | 'volume' | 'value';

export function IdxMovers({ params, set, report }: PanelProps) {
  const view = (params.view as string) ?? 'table';
  const group = (params.group as string) ?? 'all';
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'changePct', dir: -1 });
  const focus = useStore((s) => s.focus);
  const universe = group === 'all' ? LQ45.map((i) => i.symbol) : (SECTORS[group]?.codes ?? []).map((c) => `${c}.JK`);
  const { data, error, reload } = useApi<Envelope<Quote[]>>(`/api/quotes?symbols=${encodeURIComponent(universe.join(','))}`, 60_000);

  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: group === 'all' ? 'LQ45' : SECTORS[group]?.label });
  }, [data, report, group]);

  const rows = useMemo(() => {
    const qs = (data?.data ?? []).map((q) => ({ ...q, value: (q.volume ?? 0) * q.price }));
    return qs.sort((a, b) => {
      const av = a[sort.key] as number | string;
      const bv = b[sort.key] as number | string;
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }, [data, sort]);

  const breadth = useMemo(() => {
    const qs = data?.data ?? [];
    return { up: qs.filter((q) => q.changePct > 0).length, down: qs.filter((q) => q.changePct < 0).length, flat: qs.filter((q) => q.changePct === 0).length };
  }, [data]);

  const th = (key: SortKey, label: string, num = true) => (
    <th className={`sortable ${num ? 'num' : ''}`} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      {label}
      {sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="View">
          <button className={view === 'table' ? 'on' : ''} onClick={() => set({ view: 'table' })}>TABLE</button>
          <button className={view === 'heat' ? 'on' : ''} onClick={() => set({ view: 'heat' })}>HEATMAP</button>
        </div>
        <select className="field" value={group} onChange={(e) => set({ group: e.target.value })} aria-label="Sector">
          <option value="all">All LQ45</option>
          {Object.entries(SECTORS).map(([k, s]) => (
            <option key={k} value={k}>
              {s.label}
            </option>
          ))}
        </select>
        {data && (
          <span className="mono" style={{ fontSize: 11, marginLeft: 'auto' }}>
            <span className="up">▲{breadth.up}</span> <span className="down">▼{breadth.down}</span> <span className="mute">■{breadth.flat}</span>
          </span>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {data && view === 'heat' && (
          <div className="heat">
            {[...(data.data ?? [])]
              .sort((a, b) => (b.volume ?? 0) * b.price - (a.volume ?? 0) * a.price)
              .map((q) => (
                <button key={q.symbol} style={{ background: heatColor(q.changePct) }} onClick={() => focus(q.symbol)} title={`${q.name}: ${fmtPct(q.changePct)}`}>
                  <span className="t">{q.label}</span>
                  <span className="p">{fmtPct(q.changePct)}</span>
                </button>
              ))}
          </div>
        )}
        {data && view === 'table' && (
          <table className="tbl">
            <thead>
              <tr>
                {th('label', 'Ticker', false)}
                {th('price', 'Last')}
                {th('changePct', '%')}
                {th('volume', 'Volume')}
                {th('value', 'Value (Rp)')}
                <th className="num">20D</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.symbol} className="click" onClick={() => focus(q.symbol)}>
                  <td>
                    <div className="sym">{q.label}</div>
                    <div className="name">{q.name}</div>
                  </td>
                  <td className="num">{fmtPrice(q.price, 'IDR')}</td>
                  <td className="num">
                    <span className={`chg-pill ${dirClass(q.changePct)}`}>{fmtPct(q.changePct)}</span>
                  </td>
                  <td className="num">{fmtCompact(q.volume)}</td>
                  <td className="num">{fmtCompact(q.value)}</td>
                  <td className="num">
                    <Sparkline values={q.spark} width={56} height={18} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ───────────── FX · FX Board ─────────────

const FX_ORDER = ['IDR', 'EUR', 'JPY', 'GBP', 'CNY', 'SGD', 'MYR', 'THB', 'PHP', 'AUD', 'INR', 'KRW', 'HKD', 'CHF', 'CAD'];
const FX_NAMES: Record<string, string> = { IDR: 'Rupiah', EUR: 'Euro', JPY: 'Yen', GBP: 'Pound', CNY: 'Yuan', SGD: 'Singapore $', MYR: 'Ringgit', THB: 'Baht', PHP: 'Peso', AUD: 'Australian $', INR: 'Rupee', KRW: 'Won', HKD: 'Hong Kong $', CHF: 'Franc', CAD: 'Canadian $' };

export function FxPanel({ params, set, report }: PanelProps) {
  const quote = (params.quote as string) ?? 'USD';
  const { data, error, reload } = useApi<Envelope<FxBoard>>('/api/fx', 30 * 60_000);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `ECB ref. ${data.data.date}` });
  }, [data, report]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={8} />;
  const { rates, prior } = data.data;
  // Rates are per 1 USD. Re-base for IDR view: how many rupiah per 1 unit of each currency.
  const idrPerUsd = rates.IDR;
  const rows = FX_ORDER.filter((c) => rates[c] && (quote === 'USD' || c !== 'IDR')).map((c) => {
    const now = quote === 'USD' ? rates[c] : idrPerUsd / rates[c];
    const was = prior ? (quote === 'USD' ? prior.rates[c] : prior.rates.IDR / prior.rates[c]) : undefined;
    // Currency strength vs USD over the month: positive = currency strengthened.
    const strength = prior?.rates[c] ? ((prior.rates[c] - rates[c]) / rates[c]) * 100 : undefined;
    return { c, now, was, chg: was ? ((now - was) / was) * 100 : undefined, strength };
  });
  if (quote === 'IDR') rows.unshift({ c: 'USD', now: idrPerUsd, was: prior?.rates.IDR, chg: prior ? ((idrPerUsd - prior.rates.IDR) / prior.rates.IDR) * 100 : undefined, strength: undefined });
  const maxS = Math.max(...rows.map((r) => Math.abs(r.strength ?? 0)), 0.5);
  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Quote">
          <button className={quote === 'USD' ? 'on' : ''} onClick={() => set({ quote: 'USD' })}>PER 1 USD</button>
          <button className={quote === 'IDR' ? 'on' : ''} onClick={() => set({ quote: 'IDR' })}>IN RUPIAH</button>
        </div>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>CCY</th>
            <th className="num">{quote === 'USD' ? 'Per USD' : 'Rp per unit'}</th>
            <th className="num">1M %</th>
            {quote === 'USD' && <th>Strength vs USD (1M)</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.c}>
              <td>
                <span className="sym">{r.c}</span> <span className="name">{FX_NAMES[r.c] ?? 'US Dollar'}</span>
              </td>
              <td className="num">{fmtNum(r.now, r.now > 1000 ? 0 : r.now > 10 ? 2 : 4)}</td>
              <td className={`num ${quote === 'IDR' ? dirClass(r.chg) : dirClass(-(r.chg ?? 0))}`}>{fmtPct(r.chg)}</td>
              {quote === 'USD' && (
                <td style={{ width: '38%' }}>
                  {r.strength != null && (
                    <div style={{ position: 'relative', height: 8, background: 'var(--line-soft)', borderRadius: 4 }} title={`${fmtPct(r.strength)} vs USD`}>
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: r.strength >= 0 ? '50%' : `${50 - (Math.abs(r.strength) / maxS) * 50}%`,
                          width: `${(Math.abs(r.strength) / maxS) * 50}%`,
                          background: r.strength >= 0 ? 'var(--up)' : 'var(--down)',
                          borderRadius: 4,
                        }}
                      />
                      <div style={{ position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1, background: 'var(--text-mute)' }} />
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="disclaimer">ECB euro foreign-exchange reference rates (published once per business day around 16:00 CET), via Frankfurter. Reference only — not tradable quotes.</div>
    </div>
  );
}

// ───────────── CLK · Market Hours ─────────────

interface Exchange {
  name: string;
  city: string;
  tz: string;
  open: string;
  close: string;
  /** Optional lunch break (local). */
  lunch?: [string, string];
}

const EXCHANGES: Exchange[] = [
  { name: 'IDX', city: 'Jakarta', tz: 'Asia/Jakarta', open: '09:00', close: '15:50', lunch: ['12:00', '13:30'] },
  { name: 'SGX', city: 'Singapore', tz: 'Asia/Singapore', open: '09:00', close: '17:00', lunch: ['12:00', '13:00'] },
  { name: 'Bursa', city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', open: '09:00', close: '17:00', lunch: ['12:30', '14:30'] },
  { name: 'SET', city: 'Bangkok', tz: 'Asia/Bangkok', open: '10:00', close: '16:30', lunch: ['12:30', '14:30'] },
  { name: 'TSE', city: 'Tokyo', tz: 'Asia/Tokyo', open: '09:00', close: '15:30', lunch: ['11:30', '12:30'] },
  { name: 'HKEX', city: 'Hong Kong', tz: 'Asia/Hong_Kong', open: '09:30', close: '16:00', lunch: ['12:00', '13:00'] },
  { name: 'SSE', city: 'Shanghai', tz: 'Asia/Shanghai', open: '09:30', close: '15:00', lunch: ['11:30', '13:00'] },
  { name: 'XETRA', city: 'Frankfurt', tz: 'Europe/Berlin', open: '09:00', close: '17:30' },
  { name: 'LSE', city: 'London', tz: 'Europe/London', open: '08:00', close: '16:30' },
  { name: 'NYSE', city: 'New York', tz: 'America/New_York', open: '09:30', close: '16:00' },
];

export function userTimeZone(): string {
  try {
    return Intl.DateTimeFormat('en-US').resolvedOptions().timeZone;
  } catch {
    return 'local time';
  }
}

/** Minutes east of UTC for a zone at a moment (handles DST). Exported for tests. */
export function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

function localMinutes(tz: string, hhmm: string, now: Date): number {
  // Convert exchange-local hh:mm today → minutes since local midnight for the viewer.
  const [h, m] = hhmm.split(':').map(Number);
  const exOff = tzOffsetMinutes(tz, now);
  const myOff = -now.getTimezoneOffset();
  return (((h * 60 + m - exOff + myOff) % 1440) + 1440) % 1440;
}

function exchangeState(ex: Exchange, now: Date): 'open' | 'lunch' | 'closed' | 'weekend' {
  const off = tzOffsetMinutes(ex.tz, now);
  const local = new Date(now.getTime() + off * 60000);
  const dow = local.getUTCDay();
  if (dow === 0 || dow === 6) return 'weekend';
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toM = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  if (mins < toM(ex.open) || mins >= toM(ex.close)) return 'closed';
  if (ex.lunch && mins >= toM(ex.lunch[0]) && mins < toM(ex.lunch[1])) return 'lunch';
  return 'open';
}

export function MarketHours({ report }: PanelProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    report({ source: 'static', provider: 'Regular session hours (holidays not included)', sub: userTimeZone() });
    return () => clearInterval(id);
  }, [report]);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <div className="sessions">
      <div className="sess mute" style={{ fontSize: 10 }}>
        <span>Your time</span>
        <span className="mono" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
        </span>
        <span />
      </div>
      {EXCHANGES.map((ex) => {
        const o = localMinutes(ex.tz, ex.open, now);
        const c = localMinutes(ex.tz, ex.close, now);
        const st = exchangeState(ex, now);
        const bands: [number, number][] = o < c ? [[o, c]] : [[o, 1440], [0, c]];
        return (
          <div className="sess" key={ex.name}>
            <span>
              <b className="mono">{ex.name}</b> <span className="mute">{ex.city}</span>
            </span>
            <span className="track">
              {bands.map(([a, b], i) => (
                <span key={i} className="open-band" style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />
              ))}
              <span className="now" style={{ left: `${(nowMin / 1440) * 100}%` }} />
            </span>
            <span className={`mono state ${st === 'open' ? 'open' : ''}`} style={{ textAlign: 'right', fontSize: 11, color: st === 'lunch' ? 'var(--warn)' : st === 'open' ? undefined : 'var(--text-mute)' }}>
              {st === 'open' ? '● OPEN' : st === 'lunch' ? 'LUNCH' : st === 'weekend' ? 'WEEKEND' : 'CLOSED'}
            </span>
          </div>
        );
      })}
      <div className="disclaimer" style={{ padding: '8px 0 0' }}>
        Regular sessions only; public holidays and pre/post-market aren&apos;t shown. IDX Friday hours differ (lunch 11:30–14:00).
      </div>
    </div>
  );
}
