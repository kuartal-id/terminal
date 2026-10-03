import { useEffect, useMemo } from 'react';
import type { Envelope, MacroSeries, YieldCurve } from '@shared/types';
import { useApi } from '../lib/api';
import { fmtNum } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import { LineChart, seriesColor } from '../components/LineChart';
import type { PanelProps } from './types';

// ───────────── YC · US Yield Curve ─────────────

const TENOR_ORDER = ['1M', '6W', '2M', '3M', '4M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];

export function YieldCurvePanel({ report }: PanelProps) {
  const { data, error, reload } = useApi<Envelope<YieldCurve>>('/api/yields', 60 * 60_000);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: data.data.date });
  }, [data, report]);
  const stats = useMemo(() => {
    if (!data) return undefined;
    const p = data.data.points;
    const get = (t: string) => p.find((x) => x.tenor === t)?.value;
    const y2 = get('2Y');
    const y10 = get('10Y');
    const m3 = get('3M');
    return { s2s10: y2 != null && y10 != null ? (y10 - y2) * 100 : undefined, m3s10: m3 != null && y10 != null ? (y10 - m3) * 100 : undefined, y10, y2 };
  }, [data]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data || !stats) return <Loading rows={6} />;
  // Evenly spaced tenors (ordinal axis) so the short end stays readable.
  const order = TENOR_ORDER.filter((t) => data.data.points.some((p) => p.tenor === t));
  const toSeries = (name: string, pts: YieldCurve['points'], i: number, dashed = false) => ({
    name,
    color: seriesColor(i),
    dashed,
    points: pts.filter((x) => order.includes(x.tenor)).map((x) => ({ x: order.indexOf(x.tenor), y: x.value })),
  });
  const series = [toSeries(`Latest (${data.data.date})`, data.data.points, 0), ...data.data.compare.map((c, i) => toSeries(`${c.label} (${c.date})`, c.points, i + 1, true))];
  const labelFor = (i: number) => order[i] ?? '';
  const inverted = (stats.s2s10 ?? 0) < 0;
  return (
    <div>
      <div className="toolbar" style={{ gap: 16 }}>
        <span className="mono" style={{ fontSize: 12 }}>
          2s10s <b className={inverted ? 'down' : 'up'}>{fmtNum(stats.s2s10, 0)}bp</b>
        </span>
        <span className="mono" style={{ fontSize: 12 }}>
          3m10y <b className={(stats.m3s10 ?? 0) < 0 ? 'down' : 'up'}>{fmtNum(stats.m3s10, 0)}bp</b>
        </span>
        <span className="mono" style={{ fontSize: 12 }}>
          10Y <b>{fmtNum(stats.y10, 2)}%</b>
        </span>
        <span className="mute" style={{ fontSize: 11, marginLeft: 'auto' }}>{inverted ? 'Curve inverted (2s10s < 0)' : 'Curve positively sloped'}</span>
      </div>
      <div style={{ padding: '8px 6px' }}>
        <LineChart series={series} height={230} xLabel={labelFor} xTicks={order.map((_, i) => i)} yFormat={(y) => `${y.toFixed(2)}%`} zeroLine={false} />
      </div>
      <div className="disclaimer">US Treasury daily par yield curve rates. Tenors are evenly spaced (not proportional to maturity).</div>
    </div>
  );
}

// ───────────── MAC · Macro Compare ─────────────

export function MacroPanel({ params, set, report }: PanelProps) {
  const indicator = (params.indicator as string) ?? 'NY.GDP.MKTP.KD.ZG';
  const countries = (params.countries as string) ?? 'IDN,MYS,THA,PHL,VNM';
  const meta = useApi<{ indicators: Record<string, string>; countries: Record<string, string> }>('/api/macro/meta');
  const { data, error, reload } = useApi<Envelope<MacroSeries[]>>(`/api/macro?indicator=${indicator}&countries=${countries}`);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: data.data[0]?.indicatorName });
  }, [data, report]);
  const selected = countries.split(',');
  const toggle = (c: string) => {
    const next = selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c].slice(-8);
    if (next.length) set({ countries: next.join(',') });
  };
  const latest = (s: MacroSeries) => [...s.points].reverse().find((p) => p.value != null);
  const isMoney = indicator === 'NY.GDP.PCAP.CD' || indicator === 'PA.NUS.FCRF';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <select className="field" value={indicator} onChange={(e) => set({ indicator: e.target.value })} aria-label="Indicator" style={{ maxWidth: 280 }}>
          {Object.entries(meta.data?.indicators ?? { [indicator]: indicator }).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="toolbar" style={{ gap: 4 }}>
        {Object.entries(meta.data?.countries ?? {}).map(([k, v]) => (
          <button key={k} className={`chip ${selected.includes(k) ? 'on' : ''}`} onClick={() => toggle(k)} title={v} aria-pressed={selected.includes(k)}>
            {k}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={6} />}
        {data && (
          <>
            <LineChart
              series={data.data.map((s, i) => ({ name: s.countryName, color: seriesColor(i), points: s.points.map((p) => ({ x: p.year, y: p.value })) }))}
              height={210}
              yFormat={(y) => (isMoney ? (Math.abs(y) >= 1000 ? `${(y / 1000).toFixed(1)}k` : y.toFixed(0)) : `${y.toFixed(1)}`)}
            />
            <table className="tbl" style={{ marginTop: 6 }}>
              <thead>
                <tr>
                  <th>Country</th>
                  <th className="num">Latest</th>
                  <th className="num">Year</th>
                  <th className="num">5Y avg</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((s) => {
                  const l = latest(s);
                  const vals = s.points.filter((p) => p.value != null).slice(-5).map((p) => p.value!);
                  return (
                    <tr key={s.country}>
                      <td>{s.countryName}</td>
                      <td className="num">{l ? fmtNum(l.value, isMoney ? 0 : 2) : '—'}</td>
                      <td className="num mute">{l?.year ?? '—'}</td>
                      <td className="num">{vals.length ? fmtNum(vals.reduce((a, b) => a + b, 0) / vals.length, isMoney ? 0 : 2) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="disclaimer">Source: World Bank Open Data, licensed CC BY 4.0. Annual data; the latest year may lag by 1–2 years.</div>
    </div>
  );
}
