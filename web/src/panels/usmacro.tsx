import { useEffect, useState } from 'react';
import type { Envelope } from '@shared/types';
import type { CotRow, FundamentalsResponse, MacroDashboard, MacroSeriesOut, PredictionMarket } from '@shared/research';
import { useApi } from '../lib/api';
import { dirClass, fmtCompact, fmtNum } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import { LineChart, ScoreBar } from '../components/charts';
import type { PanelProps } from './types';

function useReport<T>(data: Envelope<T> | undefined, report: PanelProps['report'], sub?: string) {
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub });
  }, [data, report, sub]);
}

const fmtVal = (v: number | null | undefined, units: string) => {
  if (v == null) return '—';
  if (units === '$bn') return `$${fmtNum(v, Math.abs(v) >= 100 ? 0 : 1)}bn`;
  if (units === 'k') return `${fmtNum(v, 0)}k`;
  if (units === '0/1') return v ? 'Recession' : 'Expansion';
  return `${fmtNum(v, 2)}${units === '%' ? '%' : units === 'pp' ? ' pp' : ''}`;
};

function SeriesCard({ s, compact }: { s: MacroSeriesOut; compact?: boolean }) {
  const lastDate = s.latest?.date ?? '';
  return (
    <div className="rcard" style={{ padding: 8, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{s.name}</span>
        <span className="mono mute" style={{ fontSize: 10 }}>{lastDate}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', margin: '2px 0' }}>
        <b className="mono" style={{ fontSize: 18 }}>{fmtVal(s.latest?.value, s.units)}</b>
        {s.change != null && s.units !== '0/1' && <span className={`mono ${dirClass(s.change)}`} style={{ fontSize: 11 }}>{s.change > 0 ? '+' : ''}{fmtNum(s.change, s.units === '$bn' || s.units === 'k' ? 0 : 2)}</span>}
        {s.yearAgo != null && s.units !== '0/1' && <span className="mute" style={{ fontSize: 11 }}>1y ago {fmtVal(s.yearAgo, s.units)}</span>}
      </div>
      {!compact && <LineChart ariaLabel={s.name} height={70} lines={[{ name: s.name, values: s.points.map((p) => p.value) }]} zero={s.points.some((p) => p.value < 0)} labels={s.points.length ? [s.points[0].date.slice(0, 7), s.points[s.points.length - 1].date.slice(0, 7)] : undefined} />}
      <div className="mute mono" style={{ fontSize: 9 }}>FRED: {s.id} · {s.frequency}</div>
    </div>
  );
}

const TOPIC_NOTES: Record<string, string> = {
  'real-yields': 'TIPS yields are what Treasuries pay after expected inflation. Rising real yields tighten financial conditions for risk assets and emerging markets like Indonesia.',
  liquidity: 'Net liquidity = Fed balance sheet − Treasury cash (TGA) − reverse repo. A popular gauge of dollars available to markets; correlation with prices is loose and changes over time.',
  recession: 'Composite of public recession indicators. The score describes current conditions, not a forecast probability.',
  employment: 'US labour market from BLS releases. Monthly payroll change = difference between consecutive monthly levels.',
  inflation: 'Consumer price inflation (BLS, BEA) plus the market-implied 5y5y forward from Treasury yields.',
  funding: 'Funding stress rises when repo rates trade above the Fed’s reserve rate, rate dispersion widens, banks tap the Fed’s standing repo, and the reverse-repo buffer runs dry.',
  fiscal: 'US Treasury Monthly Statement and debt data. Negative surplus = deficit.',
  growth: 'Real GDP (BEA), the Atlanta Fed GDPNow model nowcast, industrial production and retail sales.',
};

export function macroTopicPanel(topic: string, gaugeInvert = true) {
  return function MacroTopicPanel({ report, compact }: PanelProps) {
    const { data, error, reload } = useApi<Envelope<MacroDashboard>>(`/api/research/macro/${topic}`, 60 * 60_000);
    useReport(data, report, 'United States');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
          {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
          {!data && !error && <Loading rows={8} />}
          {data && (
            <>
              {data.note && <div style={{ color: 'var(--warn)', fontSize: 12 }}>{data.note}</div>}
              {data.data.gauge && (
                <div className="rcard" style={{ padding: 10, display: 'grid', gap: 8 }}>
                  <ScoreBar score={data.data.gauge.score} label={data.data.gauge.label} invert={gaugeInvert} />
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }} className="dim">
                    {data.data.gauge.explain.map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
              {data.data.derived?.map((d) => (
                <div key={d.name} className="rcard" style={{ padding: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 12 }}>{d.name}</b>
                    <b className="mono">{fmtVal(d.latest?.value, d.units)}</b>
                  </div>
                  <LineChart ariaLabel={d.name} height={110} lines={[{ name: d.name, values: d.points.map((p) => p.value) }]} labels={d.points.length ? [d.points[0].date.slice(0, 7), d.points[d.points.length - 1].date.slice(0, 7)] : undefined} />
                </div>
              ))}
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                {data.data.series.map((s, i) => <SeriesCard key={`${s.id}-${i}`} s={s} compact={compact} />)}
              </div>
            </>
          )}
        </div>
        <div className="disclaimer">{TOPIC_NOTES[topic]} Source: FRED (public-domain US government series).</div>
      </div>
    );
  };
}

// ───────────── COT · Commitments of Traders ─────────────

export function CotPanel({ params, set, report }: PanelProps) {
  const { data, error, reload } = useApi<Envelope<CotRow[]>>('/api/research/cot', 60 * 60_000);
  const sel = String(params.market ?? '088691');
  useReport(data, report, data?.data[0] ? `report ${data.data[0].date}` : undefined);
  const row = data?.data.find((r) => r.code === sel) ?? data?.data[0];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {data && (
          <>
            {row && (
              <div style={{ padding: 8 }}>
                <div className="section-label">{row.market}: speculative net position, 3 years</div>
                <LineChart ariaLabel={`${row.market} net speculative position`} height={110} zero lines={[{ name: 'Net', values: row.history.map((h) => h.net) }]} labels={[row.history[0]?.date.slice(0, 7) ?? '', row.history[row.history.length - 1]?.date.slice(0, 7) ?? '']} />
              </div>
            )}
            <table className="tbl">
              <thead><tr><th>Market</th><th className="num">Net spec</th><th className="num">Wk chg</th><th className="num">% OI</th><th className="num" title="Where the net position sits in its 3-year range (0 = most short, 100 = most long)">COT idx</th></tr></thead>
              <tbody>
                {data.data.map((r) => (
                  <tr key={r.code} className="click" onClick={() => set({ market: r.code })} style={r.code === row?.code ? { background: 'var(--panel-alt)' } : undefined}>
                    <td>{r.market}</td>
                    <td className={`num mono ${dirClass(r.netSpec)}`}>{fmtCompact(r.netSpec)}</td>
                    <td className={`num mono ${dirClass(r.netSpecChange)}`}>{r.netSpecChange > 0 ? '+' : ''}{fmtCompact(r.netSpecChange)}</td>
                    <td className="num mono">{fmtNum(r.netPctOi, 1)}%</td>
                    <td className="num mono" style={{ color: r.cotIndex >= 90 || r.cotIndex <= 10 ? 'var(--warn)' : undefined }}>{r.cotIndex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
      <div className="disclaimer">CFTC legacy report, futures only: non-commercial (speculative) longs minus shorts, as of Tuesday, published Friday. A COT index near 0 or 100 marks an extreme in the 3-year range.</div>
    </div>
  );
}

// ───────────── CFD · Company Fundamentals (SEC) ─────────────

export function FundamentalsPanel({ params, set, report }: PanelProps) {
  const ticker = String(params.ticker ?? 'AAPL');
  const [text, setText] = useState(ticker);
  useEffect(() => setText(ticker), [ticker]);
  const { data, error, reload } = useApi<Envelope<FundamentalsResponse>>(`/api/research/fundamentals?ticker=${encodeURIComponent(ticker)}`);
  useReport(data, report, data?.data.name);
  const f = data?.data;
  const bn = (v?: number) => (v == null ? '—' : fmtNum(v / 1e9, 1));
  const rows: [string, (a: FundamentalsResponse['annual'][number]) => string][] = [
    ['Revenue', (a) => bn(a.revenue)],
    ['Operating income', (a) => bn(a.operatingIncome)],
    ['Net income', (a) => bn(a.netIncome)],
    ['EPS (diluted)', (a) => (a.eps == null ? '—' : fmtNum(a.eps, 2))],
    ['Operating cash flow', (a) => bn(a.operatingCashFlow)],
    ['Capex', (a) => bn(a.capex)],
    ['Cash', (a) => bn(a.cash)],
    ['Total assets', (a) => bn(a.assets)],
    ['Total liabilities', (a) => bn(a.liabilities)],
    ['Shareholders’ equity', (a) => bn(a.equity)],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <form onSubmit={(e) => (e.preventDefault(), text.trim() && set({ ticker: text.trim().toUpperCase() }))}>
          <input className="field mono" style={{ width: 100 }} value={text} onChange={(e) => setText(e.target.value)} aria-label="US ticker" placeholder="US ticker" />
        </form>
        <span className="mute" style={{ fontSize: 11 }}>US SEC filers · figures in {f?.currency ?? 'USD'} billions</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {f && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
              <b style={{ fontSize: 15 }}>{f.name}</b>
              <a href={f.filingsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>10-K filings on SEC EDGAR ↗</a>
            </div>
            <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
              {f.ratios.map((r) => (
                <div key={r.name} className="rcard" style={{ padding: '6px 8px' }}>
                  <div className="mute" style={{ fontSize: 10 }}>{r.name}</div>
                  <b className="mono">{r.value == null ? '—' : `${fmtNum(r.value, r.units === '×' ? 2 : 1)}${r.units === '%' ? '%' : r.units === '×' ? '×' : ''}`}</b>
                  {r.units.includes('bn') && <span className="mute" style={{ fontSize: 10 }}> bn</span>}
                </div>
              ))}
            </div>
            <LineChart ariaLabel="Revenue and net income" height={110} lines={[{ name: 'Revenue', values: f.annual.map((a) => (a.revenue ?? NaN) / 1e9) }, { name: 'Net income', values: f.annual.map((a) => (a.netIncome ?? NaN) / 1e9) }]} labels={f.annual.map((a) => String(a.fy))} zero />
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ fontSize: 11 }}>
                <thead><tr><th>Calendar year</th>{f.annual.map((a) => <th key={a.fy} className="num">{a.fy}</th>)}</tr></thead>
                <tbody>{rows.map(([k, g]) => <tr key={k}><td>{k}</td>{f.annual.map((a) => <td key={a.fy} className="num mono">{g(a)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <div className="disclaimer">From companies’ annual 10-K XBRL filings (SEC EDGAR), aligned to calendar years by the SEC’s frames. IDX company fundamentals need a licensed source and are not shown yet.</div>
    </div>
  );
}

// ───────────── PMK · Prediction Markets ─────────────

export function PredictionPanel({ params, set, report }: PanelProps) {
  const topic = String(params.topic ?? 'economy');
  const { data, error, reload } = useApi<Envelope<PredictionMarket[]>>(`/api/research/predictions?topic=${topic}`, 10 * 60_000);
  useReport(data, report, topic);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Topic">
          {[['economy', 'ECONOMY'], ['fed-rates', 'FED'], ['geopolitics', 'GEOPOLITICS'], ['crypto', 'CRYPTO'], ['politics', 'POLITICS']].map(([k, l]) => (
            <button key={k} className={k === topic ? 'on' : ''} onClick={() => set({ topic: k })}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {data && (
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
            {data.data.map((m) => (
              <div key={m.id} className="rcard" style={{ padding: 8, display: 'grid', gap: 6, alignContent: 'start' }}>
                <b style={{ fontSize: 12, lineHeight: 1.35 }}>{m.question}</b>
                {m.outcomes.slice(0, 4).map((o) => (
                  <div key={o.name} style={{ display: 'grid', gridTemplateColumns: '1fr 48px', gap: 6, alignItems: 'center', fontSize: 11 }}>
                    <div style={{ position: 'relative', height: 18, background: 'var(--line-soft)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${o.probability}%`, background: 'var(--info-soft)' }} />
                      <span style={{ position: 'relative', paddingLeft: 6, lineHeight: '18px' }}>{o.name}</span>
                    </div>
                    <b className="mono num">{fmtNum(o.probability, 0)}%</b>
                  </div>
                ))}
                <div className="mute" style={{ fontSize: 10 }}>Volume ${fmtCompact(m.volume)}{m.endDate ? ` · resolves ${m.endDate.slice(0, 10)}` : ''}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="disclaimer">Crowd-implied probabilities from Polymarket prices, shown as information only. Kuartal does not endorse or facilitate betting.</div>
    </div>
  );
}


