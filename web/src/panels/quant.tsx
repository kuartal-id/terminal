import { useEffect, useState } from 'react';
import type { Envelope } from '@shared/types';
import type { BreadthStats, ComparisonResponse, PortfolioResult, RatioStats, RegressionStats, RotationRow, SeriesStats, TermCurve, VolRow } from '@shared/research';
import { resolveInstrument } from '@shared/instruments';
import { useApi } from '../lib/api';
import { dirClass, fmtCompact, fmtNum, fmtPct } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import { Histogram, Legend, LineChart, RotationMap, Scatter } from '../components/charts';
import { SymbolField } from './technical';
import type { PanelProps } from './types';

const dateLabel = (t: number) => new Date(t * 1000).toISOString().slice(0, 7);

function Body({ data, error, reload, children, rows = 6 }: { data: unknown; error?: Error; reload: () => void; children: () => React.ReactNode; rows?: number }) {
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={rows} />;
  return <>{children()}</>;
}

function RangeSeg({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <div className="seg" role="group" aria-label="Range">
      {['1Y', '5Y'].map((r) => (
        <button key={r} className={r === value ? 'on' : ''} onClick={() => onChange(r)}>{r}</button>
      ))}
    </div>
  );
}

function useReport<T>(data: Envelope<T> | undefined, report: PanelProps['report'], sub?: string) {
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub });
  }, [data, report, sub]);
}

function StatsGrid({ s }: { s: SeriesStats }) {
  const items: [string, string, number?][] = [
    ['Total return', fmtPct(s.totalReturnPct), s.totalReturnPct],
    ['CAGR', fmtPct(s.cagrPct), s.cagrPct],
    ['Volatility (ann.)', `${fmtNum(s.volAnnPct, 1)}%`],
    ['Sharpe (rf = 0)', fmtNum(s.sharpe, 2)],
    ['Max drawdown', fmtPct(s.maxDrawdownPct), s.maxDrawdownPct],
    ['VaR 95% (1 bar)', fmtPct(s.var95Pct), s.var95Pct],
    ['Best / worst bar', `${fmtPct(s.bestPct)} / ${fmtPct(s.worstPct)}`],
    ['Positive bars', `${s.positivePct}%`],
    ['Skew', fmtNum(s.skew, 2)],
    ['Excess kurtosis', fmtNum(s.excessKurtosis, 2)],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 6 }}>
      {items.map(([k, v, d]) => (
        <div key={k} className="rcard" style={{ padding: '6px 8px' }}>
          <div className="mute" style={{ fontSize: 10 }}>{k}</div>
          <b className={`mono ${d != null ? dirClass(d) : ''}`}>{v}</b>
        </div>
      ))}
    </div>
  );
}

// ───────────── STA · Statistical Analysis ─────────────

export function StatsPanel({ params, set, report }: PanelProps) {
  const symbol = String(params.symbol ?? '^JKSE');
  const range = String(params.range ?? '1Y');
  const { data, error, reload } = useApi<Envelope<SeriesStats & { label: string; closes: number[] }>>(`/api/research/stats?symbol=${encodeURIComponent(symbol)}&range=${range}`);
  useReport(data, report, data?.data.label);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <SymbolField value={symbol} onChange={(s) => set({ symbol: s })} />
        <RangeSeg value={range} onChange={(r) => set({ range: r })} />
        <span className="mute" style={{ fontSize: 11 }}>{range === '5Y' ? 'weekly' : 'daily'} returns</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const s = data!.data;
            return (
              <>
                <LineChart ariaLabel={`${s.label} price`} lines={[{ name: s.label, values: s.closes }]} height={130} />
                <StatsGrid s={s} />
                <div className="section-label">Return distribution ({s.observations} bars)</div>
                <Histogram ariaLabel="Return distribution" bins={s.histogram.map((b) => ({ label: `${b.fromPct.toFixed(1)}%`, count: b.count }))} />
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Historical statistics describe the past only. VaR is the 5th-percentile single-bar return.</div>
    </div>
  );
}

// ───────────── CHC · Chart Comparison ─────────────

export function ComparisonPanel({ params, set, report }: PanelProps) {
  const symbols = String(params.symbols ?? '^JKSE,^GSPC,EIDO,GC=F');
  const range = String(params.range ?? '1Y');
  const { data, error, reload } = useApi<Envelope<ComparisonResponse>>(`/api/research/compare?symbols=${encodeURIComponent(symbols)}&range=${range}`);
  useReport(data, report, `${range} · rebased to 100`);
  const list = symbols.split(',');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <SymbolField value="" label="+ symbol" width={100} onChange={(s) => !list.includes(s) && set({ symbols: [...list, s].slice(-8).join(',') })} />
        <RangeSeg value={range} onChange={(r) => set({ range: r })} />
        {list.map((s) => (
          <button key={s} className="chip" onClick={() => list.length > 1 && set({ symbols: list.filter((x) => x !== s).join(',') })} title="Remove">{resolveInstrument(s)?.label ?? s} ×</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const d = data!.data;
            return (
              <>
                <LineChart ariaLabel="Normalised comparison" height={220} lines={d.lines.map((l) => ({ name: l.label, values: l.values }))} labels={d.times.length ? [dateLabel(d.times[0]), dateLabel(d.times[d.times.length - 1])] : undefined} refLines={[{ y: 100 }]} />
                <Legend items={d.lines.map((l) => ({ name: l.label, value: fmtPct(l.changePct) }))} />
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Each line starts at 100 on the first day all instruments traded, in its own currency.</div>
    </div>
  );
}

// ───────────── ARR · Assets Ratio ─────────────

export function RatioPanel({ params, set, report }: PanelProps) {
  const a = String(params.a ?? 'GC=F');
  const b = String(params.b ?? 'SI=F');
  const range = String(params.range ?? '5Y');
  const { data, error, reload } = useApi<Envelope<RatioStats & { aLabel: string; bLabel: string; times: number[] }>>(`/api/research/ratio?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&range=${range}`);
  useReport(data, report, data ? `${data.data.aLabel} / ${data.data.bLabel}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <SymbolField value={a} label="Asset A" width={90} onChange={(s) => set({ a: s })} />
        <span className="mute">÷</span>
        <SymbolField value={b} label="Asset B" width={90} onChange={(s) => set({ b: s })} />
        <RangeSeg value={range} onChange={(r) => set({ range: r })} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const r = data!.data;
            return (
              <>
                <LineChart ariaLabel="Ratio history" height={170} lines={[{ name: 'Ratio', values: r.series }]} refLines={[{ y: r.mean, label: 'mean' }]} labels={r.times.length ? [dateLabel(r.times[0]), dateLabel(r.times[r.times.length - 1])] : undefined} />
                <div className="kv">
                  <span className="mute">Current ratio</span><b className="mono">{fmtNum(r.current, 4)}</b>
                  <span className="mute">Percentile in range</span><span className="mono">{r.percentile}th</span>
                  <span className="mute">Z-score vs mean</span><span className="mono">{r.zScore}</span>
                  <span className="mute">Range</span><span className="mono">{fmtNum(r.min, 4)} – {fmtNum(r.max, 4)}</span>
                  <span className="mute">1-year change</span><span className={`mono ${dirClass(r.change1yPct)}`}>{fmtPct(r.change1yPct)}</span>
                </div>
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Ratio of daily closes on common trading days. A high percentile means A is expensive relative to B versus this window's history, not that it must revert.</div>
    </div>
  );
}

// ───────────── RBA2 · Risk & Beta ─────────────

export function BetaPanel({ params, set, report }: PanelProps) {
  const y = String(params.y ?? 'BBCA.JK');
  const x = String(params.x ?? '^JKSE');
  const range = String(params.range ?? '1Y');
  const { data, error, reload } = useApi<Envelope<RegressionStats & { yLabel: string; xLabel: string }>>(`/api/research/regression?y=${encodeURIComponent(y)}&x=${encodeURIComponent(x)}&range=${range}`);
  useReport(data, report, data ? `${data.data.yLabel} vs ${data.data.xLabel}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <SymbolField value={y} label="Asset (Y)" width={90} onChange={(s) => set({ y: s })} />
        <span className="mute">vs</span>
        <SymbolField value={x} label="Benchmark (X)" width={90} onChange={(s) => set({ x: s })} />
        <RangeSeg value={range} onChange={(r) => set({ range: r })} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignContent: 'start' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const r = data!.data;
            return (
              <>
                <Scatter points={r.points} slope={r.beta} xLabel={r.xLabel} yLabel={r.yLabel} />
                <div className="kv" style={{ alignContent: 'start' }}>
                  <span className="mute">Beta</span><b className="mono" style={{ fontSize: 18 }}>{r.beta}</b>
                  <span className="mute">Up-market beta</span><span className="mono">{r.upBeta ?? '—'}</span>
                  <span className="mute">Down-market beta</span><span className="mono">{r.downBeta ?? '—'}</span>
                  <span className="mute">Correlation</span><span className="mono">{r.correlation}</span>
                  <span className="mute">R²</span><span className="mono">{r.rSquared}</span>
                  <span className="mute">Alpha (annualised)</span><span className={`mono ${dirClass(r.alphaAnnPct)}`}>{fmtPct(r.alphaAnnPct)}</span>
                  <span className="mute">Tracking error</span><span className="mono">{fmtNum(r.trackingErrorPct, 1)}%</span>
                  <span className="mute">Observations</span><span className="mono">{r.n}</span>
                </div>
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">OLS regression of {range === '5Y' ? 'weekly' : 'daily'} returns. Beta 1.2 means the asset historically moved ~1.2% for each 1% move in the benchmark.</div>
    </div>
  );
}

// ───────────── PTS · Portfolio Simulator ─────────────

export function PortfolioSimPanel({ params, set, report }: PanelProps) {
  const symbols = String(params.symbols ?? 'BBCA.JK,TLKM.JK,EIDO,GC=F');
  const weights = String(params.weights ?? '30,20,30,20');
  const range = String(params.range ?? '5Y');
  const rebalance = String(params.rebalance ?? 'quarterly');
  const capital = Number(params.capital ?? 100_000_000);
  const benchmark = String(params.benchmark ?? '^JKSE');
  const [draft, setDraft] = useState(() => symbols.split(',').map((s, i) => ({ s, w: weights.split(',')[i] ?? '0' })));
  useEffect(() => setDraft(symbols.split(',').map((s, i) => ({ s, w: weights.split(',')[i] ?? '0' }))), [symbols, weights]);
  const url = `/api/research/portfolio?symbols=${encodeURIComponent(symbols)}&weights=${encodeURIComponent(weights)}&range=${range}&rebalance=${rebalance}&capital=${capital}&benchmark=${encodeURIComponent(benchmark)}`;
  const { data, error, reload } = useApi<Envelope<PortfolioResult & { labels: string[]; times: number[] }>>(url);
  useReport(data, report, `${range} · ${rebalance}`);
  const apply = () => {
    const rows = draft.filter((r) => r.s.trim() && Number(r.w) > 0).slice(0, 10);
    if (!rows.length) return;
    set({ symbols: rows.map((r) => resolveInstrument(r.s)?.symbol ?? r.s).join(','), weights: rows.map((r) => Number(r.w)).join(',') });
  };
  const total = draft.reduce((a, r) => a + (Number(r.w) || 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <RangeSeg value={range} onChange={(r) => set({ range: r })} />
        <div className="seg" role="group" aria-label="Rebalance">
          {['none', 'monthly', 'quarterly'].map((r) => (
            <button key={r} className={r === rebalance ? 'on' : ''} onClick={() => set({ rebalance: r })}>{r === 'none' ? 'HOLD' : r.toUpperCase()}</button>
          ))}
        </div>
        <span className="mute" style={{ fontSize: 11 }}>vs</span>
        <SymbolField value={benchmark} label="Benchmark" width={80} onChange={(s) => set({ benchmark: s })} />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
        <table className="tbl" style={{ fontSize: 12 }}>
          <thead><tr><th>Holding</th><th className="num">Weight %</th><th /></tr></thead>
          <tbody>
            {draft.map((r, i) => (
              <tr key={i}>
                <td><input className="field mono" style={{ width: 110 }} value={r.s} aria-label={`Holding ${i + 1}`} onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, s: e.target.value } : x)))} /></td>
                <td className="num"><input className="field mono" style={{ width: 64, textAlign: 'right' }} inputMode="decimal" value={r.w} aria-label={`Weight ${i + 1}`} onChange={(e) => setDraft(draft.map((x, k) => (k === i ? { ...x, w: e.target.value } : x)))} /></td>
                <td><button className="icon-btn" aria-label="Remove holding" onClick={() => setDraft(draft.filter((_, k) => k !== i))}>×</button></td>
              </tr>
            ))}
            <tr>
              <td><button className="btn small" disabled={draft.length >= 10} onClick={() => setDraft([...draft, { s: '', w: '10' }])}>+ Add</button></td>
              <td className="num mono" style={{ color: Math.abs(total - 100) > 0.01 ? 'var(--warn)' : undefined }}>{total}%</td>
              <td><button className="btn small primary" onClick={apply}>Run</button></td>
            </tr>
          </tbody>
        </table>
        {Math.abs(total - 100) > 0.01 && <p className="mute" style={{ fontSize: 11, margin: 0 }}>Weights are scaled to 100% when the simulation runs.</p>}
        <Body data={data} error={error} reload={reload}>
          {() => {
            const d = data!.data;
            return (
              <>
                <LineChart ariaLabel="Portfolio value vs benchmark" height={180} lines={[{ name: 'Portfolio', values: d.curve }, ...(d.benchCurve ? [{ name: 'Benchmark', values: d.benchCurve, dashed: true, color: 'var(--text-mute)' }] : [])]} labels={d.times.length ? [dateLabel(d.times[0]), dateLabel(d.times[d.times.length - 1])] : undefined} />
                <Legend items={[{ name: 'Portfolio', value: fmtPct(d.stats.totalReturnPct) }, ...(d.benchmark ? [{ name: 'Benchmark', color: 'var(--text-mute)', value: fmtPct(d.benchmark.totalReturnPct) }] : [])]} />
                <div className="kv"><span className="mute">Final value (start {fmtCompact(capital)})</span><b className="mono">{fmtCompact(d.finalValue)}</b></div>
                <StatsGrid s={d.stats} />
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Hypothetical back-test on historical prices in each asset's own currency, no costs, taxes or FX conversion. Past performance does not indicate future results.</div>
    </div>
  );
}

// ───────────── FXS · FX Strength ─────────────

export function FxStrengthPanel({ params, set, report }: PanelProps) {
  const win = String(params.window ?? '1M');
  const { data, error, reload } = useApi<Envelope<{ windows: { label: string; rows: { ccy: string; strength: number; returnPct: number }[] }[] }>>('/api/research/fx-strength', 10 * 60_000);
  useReport(data, report, `${win} relative strength`);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Window">
          {['1D', '1W', '1M', '3M'].map((w) => (
            <button key={w} className={w === win ? 'on' : ''} onClick={() => set({ window: w })}>{w}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const rows = data!.data.windows.find((w) => w.label === win)?.rows ?? [];
            const max = Math.max(0.01, ...rows.map((r) => Math.abs(r.strength)));
            return (
              <div style={{ display: 'grid', gap: 4 }}>
                {rows.map((r) => (
                  <div key={r.ccy} style={{ display: 'grid', gridTemplateColumns: '42px 1fr 64px', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <b className="mono" style={{ color: r.ccy === 'IDR' ? 'var(--accent)' : undefined }}>{r.ccy}</b>
                    <div style={{ position: 'relative', height: 14, background: 'var(--line-soft)', borderRadius: 3 }}>
                      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--text-mute)' }} />
                      <div style={{ position: 'absolute', top: 2, bottom: 2, borderRadius: 2, background: r.strength >= 0 ? 'var(--up)' : 'var(--down)', left: r.strength >= 0 ? '50%' : `${50 - (Math.abs(r.strength) / max) * 50}%`, width: `${(Math.abs(r.strength) / max) * 50}%` }} />
                    </div>
                    <span className={`mono num ${dirClass(r.strength)}`}>{fmtNum(r.strength, 2)}</span>
                  </div>
                ))}
              </div>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Strength = the currency's % change against USD minus the basket average (USD counted at 0). Positive = outperformed the basket.</div>
    </div>
  );
}

// ───────────── VOL · Market Volatility ─────────────

export function VolatilityPanel({ report }: PanelProps) {
  const { data, error, reload } = useApi<Envelope<{ rows: VolRow[]; vixTerm: { label: string; value: number }[] }>>('/api/research/volatility', 10 * 60_000);
  useReport(data, report, 'implied + realised');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const d = data!.data;
            const contango = d.vixTerm.length >= 2 && d.vixTerm[d.vixTerm.length - 1].value > d.vixTerm[0].value;
            return (
              <>
                <table className="tbl">
                  <thead><tr><th>Gauge</th><th className="num">Level</th><th className="num">1D</th><th className="num">1Y pct</th></tr></thead>
                  <tbody>
                    {d.rows.map((r) => (
                      <tr key={r.symbol}>
                        <td>{r.label}{r.realised && <span className="mute" style={{ fontSize: 10 }}> · realised</span>}</td>
                        <td className="num mono">{fmtNum(r.level, 2)}</td>
                        <td className={`num mono ${dirClass(r.change1dPct)}`}>{r.realised ? fmtNum(r.change1dPct, 2) : fmtPct(r.change1dPct)}</td>
                        <td className="num mono" style={{ color: (r.percentile1y ?? 0) >= 80 ? 'var(--warn)' : undefined }}>{r.percentile1y ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {d.vixTerm.length >= 2 && (
                  <div style={{ padding: 8 }}>
                    <div className="section-label">VIX term structure · {contango ? 'upward sloping (normal)' : 'inverted (near-term stress)'}</div>
                    <LineChart ariaLabel="VIX term structure" height={100} lines={[{ name: 'VIX', values: d.vixTerm.map((p) => p.value) }]} labels={d.vixTerm.map((p) => p.label)} />
                  </div>
                )}
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Implied-volatility indices from Cboe/ICE via Yahoo; realised vol = annualised 20-day standard deviation of log returns. 1Y pct = where today sits in the last year (100 = highest).</div>
    </div>
  );
}

// ───────────── BRD · Market Breadth ─────────────

export function BreadthPanel({ params, set, report }: PanelProps) {
  const u = String(params.universe ?? 'lq45');
  const { data, error, reload } = useApi<Envelope<BreadthStats & { name: string; leaders: { symbol: string; changePct: number }[]; laggards: { symbol: string; changePct: number }[] }>>(`/api/research/breadth?universe=${u}`, 15 * 60_000);
  useReport(data, report, data?.data.name);
  const meter = (label: string, pct: number) => (
    <div className="rcard" style={{ padding: 8 }}>
      <div className="mute" style={{ fontSize: 10 }}>{label}</div>
      <b className="mono" style={{ fontSize: 20, color: pct >= 60 ? 'var(--up)' : pct <= 40 ? 'var(--down)' : undefined }}>{pct}%</b>
      <div style={{ height: 6, background: 'var(--line-soft)', borderRadius: 3, marginTop: 4 }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'var(--accent)' }} /></div>
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Universe">
          {[['lq45', 'LQ45'], ['dow30', 'DOW 30']].map(([k, l]) => (
            <button key={k} className={k === u ? 'on' : ''} onClick={() => set({ universe: k })}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, alignContent: 'start' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const b = data!.data;
            return (
              <>
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                  {meter('Above 50-day avg', b.pctAbove50)}
                  {meter('Above 200-day avg', b.pctAbove200)}
                  <div className="rcard" style={{ padding: 8 }}>
                    <div className="mute" style={{ fontSize: 10 }}>Advancers / decliners</div>
                    <b className="mono"><span className="up">{b.advancers}</span> / <span className="down">{b.decliners}</span></b>
                  </div>
                  <div className="rcard" style={{ padding: 8 }}>
                    <div className="mute" style={{ fontSize: 10 }}>52-week highs / lows</div>
                    <b className="mono"><span className="up">{b.newHighs}</span> / <span className="down">{b.newLows}</span></b>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  {[['Leaders today', b.leaders], ['Laggards today', b.laggards]].map(([t, rows]) => (
                    <table key={t as string} className="tbl" style={{ fontSize: 11 }}>
                      <thead><tr><th>{t as string}</th><th className="num">1D</th></tr></thead>
                      <tbody>{(rows as { symbol: string; changePct: number }[]).map((r) => <tr key={r.symbol}><td className="mono">{r.symbol}</td><td className={`num mono ${dirClass(r.changePct)}`}>{fmtPct(r.changePct)}</td></tr>)}</tbody>
                    </table>
                  ))}
                </div>
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Breadth shows how many members participate in a move. {data ? `${data.data.members} members with data.` : ''}</div>
    </div>
  );
}

// ───────────── ROT · Theme & Sector Rotation ─────────────

export function RotationPanel({ params, set, report }: PanelProps) {
  const u = String(params.universe ?? 'countries');
  const { data, error, reload } = useApi<Envelope<{ benchmark: string; rows: RotationRow[] }>>(`/api/research/rotation?universe=${u}`, 30 * 60_000);
  useReport(data, report, data ? `vs ${data.data.benchmark}` : undefined);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Universe">
          {[['countries', 'COUNTRIES'], ['us-sectors', 'US SECTORS'], ['themes', 'THEMES']].map(([k, l]) => (
            <button key={k} className={k === u ? 'on' : ''} onClick={() => set({ universe: k })}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', alignContent: 'start' }}>
        <Body data={data} error={error} reload={reload}>
          {() => {
            const rows = data!.data.rows;
            return (
              <>
                <RotationMap rows={rows} />
                <table className="tbl" style={{ fontSize: 11 }}>
                  <thead><tr><th>Member</th><th>Quadrant</th><th className="num">1M</th><th className="num">3M</th></tr></thead>
                  <tbody>
                    {[...rows].sort((a, b) => (b.change3mPct ?? 0) - (a.change3mPct ?? 0)).map((r) => {
                      const q = r.tail[r.tail.length - 1]?.quadrant;
                      return (
                        <tr key={r.symbol}>
                          <td><span className="sym">{r.symbol}</span> <span className="name">{r.label}</span></td>
                          <td style={{ textTransform: 'capitalize', color: q === 'leading' ? 'var(--up)' : q === 'lagging' ? 'var(--down)' : q === 'weakening' ? 'var(--warn)' : 'var(--info)' }}>{q ?? '—'}</td>
                          <td className={`num mono ${dirClass(r.change1mPct)}`}>{fmtPct(r.change1mPct, 1)}</td>
                          <td className={`num mono ${dirClass(r.change3mPct)}`}>{fmtPct(r.change3mPct, 1)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            );
          }}
        </Body>
      </div>
      <div className="disclaimer">Relative rotation vs the benchmark: x = relative trend (price ratio vs its 50-day average), y = its 10-day change. Tails show ~8 weekly steps.</div>
    </div>
  );
}

// ───────────── FTS · Futures Term Structure ─────────────

export function TermStructurePanel({ report }: PanelProps) {
  const { data, error, reload } = useApi<Envelope<{ curves: TermCurve[] }>>('/api/research/term-structure', 15 * 60_000);
  useReport(data, report);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        <Body data={data} error={error} reload={reload}>
          {() =>
            data!.data.curves.length ? (
              <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {data!.data.curves.map((c) => (
                  <div key={c.root} className="rcard" style={{ padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <b>{c.name}</b>
                      <span style={{ fontSize: 11, color: c.shape === 'backwardation' ? 'var(--warn)' : c.shape === 'contango' ? 'var(--info)' : 'var(--text-dim)', textTransform: 'capitalize' }}>{c.shape} · {fmtPct(c.spreadPct, 1)}</span>
                    </div>
                    <LineChart ariaLabel={`${c.name} futures curve`} height={90} lines={[{ name: c.root, values: c.points.map((p) => p.price) }]} labels={c.points.map((p) => p.label)} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mute">{data!.note ?? 'No futures curves available right now.'}</p>
            )
          }
        </Body>
      </div>
      <div className="disclaimer">Contango = later contracts priced higher (usually ample supply / carry); backwardation = near contracts priced higher (usually tight supply).</div>
    </div>
  );
}

// ───────────── CMS · Credit Market Sentiment (ETF proxy) ─────────────

export function CreditSentimentPanel({ report }: PanelProps) {
  const hy = useApi<Envelope<RatioStats & { times: number[] }>>('/api/research/ratio?a=HYG&b=IEF&range=5Y', 30 * 60_000);
  const ig = useApi<Envelope<RatioStats & { times: number[] }>>('/api/research/ratio?a=LQD&b=IEF&range=5Y', 30 * 60_000);
  const both = hy.data && ig.data ? hy.data : undefined;
  useReport(both, report, 'ETF proxy');
  const card = (title: string, d: RatioStats | undefined, note: string) => (
    <div className="rcard" style={{ padding: 8 }}>
      <div className="section-label">{title}</div>
      {d ? (
        <>
          <LineChart ariaLabel={title} height={110} lines={[{ name: title, values: d.series }]} refLines={[{ y: d.mean }]} />
          <div className="kv" style={{ fontSize: 11 }}>
            <span className="mute">5Y percentile</span><b className="mono" style={{ color: d.percentile <= 20 ? 'var(--down)' : d.percentile >= 80 ? 'var(--up)' : undefined }}>{d.percentile}th</b>
            <span className="mute">Z-score</span><span className="mono">{d.zScore}</span>
            <span className="mute">1Y change</span><span className={`mono ${dirClass(d.change1yPct)}`}>{fmtPct(d.change1yPct)}</span>
          </div>
          <p className="mute" style={{ fontSize: 11, margin: '6px 0 0' }}>{note}</p>
        </>
      ) : (
        <Loading rows={3} />
      )}
    </div>
  );
  const err = hy.error ?? ig.error;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: 8, display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignContent: 'start' }}>
        {err && !hy.data && <ErrorBox message={err.message} onRetry={() => (hy.reload(), ig.reload())} />}
        {card('High yield vs Treasuries (HYG ÷ IEF)', hy.data?.data, 'Rising = junk bonds outperforming Treasuries → credit risk appetite improving.')}
        {card('Investment grade vs Treasuries (LQD ÷ IEF)', ig.data?.data, 'Falling = corporate credit lagging government bonds → spreads likely widening.')}
      </div>
      <div className="disclaimer">Proxy from bond-ETF total-return prices, not official option-adjusted spreads (ICE BofA OAS data is copyrighted and not redistributed here).</div>
    </div>
  );
}

