import { useEffect, useState } from 'react';
import type { Envelope } from '@shared/types';
import type { TechnicalsResponse, TimeframeAnalysis } from '@shared/research';
import { resolveInstrument } from '@shared/instruments';
import { useApi } from '../lib/api';
import { fmtNum, fmtPct } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import { LineChart } from '../components/charts';
import type { PanelProps } from './types';

/** Symbol picker shared by research panels: type a ticker/alias and press Enter. */
export function SymbolField({ value, onChange, label = 'Symbol', width = 120 }: { value: string; onChange: (symbol: string) => void; label?: string; width?: number }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const inst = resolveInstrument(text);
        if (inst) onChange(inst.symbol);
      }}
      style={{ display: 'inline-flex' }}
    >
      <input className="field mono" style={{ width }} value={text} onChange={(e) => setText(e.target.value)} aria-label={label} placeholder={label} onBlur={() => setText(value)} />
    </form>
  );
}

const READ_COLOR: Record<string, string> = { positive: 'var(--up)', negative: 'var(--down)', neutral: 'var(--text-dim)', stretched: 'var(--warn)' };
const TF_NAME: Record<string, string> = { '1D': 'Daily', '4H': '4-hour', '15M': '15-minute' };

export type TechView = 'indicators' | 'trend' | 'meanrev' | 'levels' | 'structure';

function Frame({ f, view }: { f: TimeframeAnalysis; view: TechView }) {
  const head = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div className="section-label">{TF_NAME[f.tf]}</div>
      <span className="mono mute" style={{ fontSize: 11 }}>{f.bars} bars</span>
    </div>
  );
  if (view === 'indicators') {
    const counts = f.indicators.reduce<Record<string, number>>((a, r) => ((a[r.read] = (a[r.read] ?? 0) + 1), a), {});
    return (
      <div className="rcard" style={{ padding: 8 }}>
        {head}
        <div style={{ fontSize: 11, margin: '4px 0 6px' }} className="dim">
          <span style={{ color: 'var(--up)' }}>{counts.positive ?? 0} positive</span> · <span style={{ color: 'var(--down)' }}>{counts.negative ?? 0} negative</span> · <span style={{ color: 'var(--warn)' }}>{counts.stretched ?? 0} stretched</span>
        </div>
        <table className="tbl" style={{ fontSize: 11 }}>
          <tbody>
            {f.indicators.map((r) => (
              <tr key={r.name} title={r.note}>
                <td>{r.name}</td>
                <td className="num mono">{fmtNum(r.value, Math.abs(r.value) < 10 ? 3 : 2)}</td>
                <td style={{ color: READ_COLOR[r.read], fontSize: 10 }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (view === 'trend') {
    const t = f.trend;
    const col = t.trend === 'up' ? 'var(--up)' : t.trend === 'down' ? 'var(--down)' : 'var(--text-dim)';
    return (
      <div className="rcard" style={{ padding: 8 }}>
        {head}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '4px 0' }}>
          <b style={{ fontSize: 18, color: col, textTransform: 'uppercase' }}>{t.trend === 'flat' ? 'Sideways' : `${t.trend}trend`}</b>
          <span className="mono" style={{ color: col }}>{t.score > 0 ? '+' : ''}{t.score}</span>
        </div>
        <div className="dim" style={{ fontSize: 11, marginBottom: 6 }}>Momentum {t.momentum}</div>
        <LineChart ariaLabel={`${TF_NAME[f.tf]} closes`} height={90} lines={[{ name: 'Close', values: f.closes }]} />
        <div className="kv" style={{ marginTop: 6, fontSize: 11 }}>
          <span className="mute">EMA 20 / 50</span><span className="mono">{fmtNum(t.ema20, 2)} / {fmtNum(t.ema50, 2)}</span>
          <span className="mute">EMA 20 slope (5 bars)</span><span className="mono">{fmtPct(t.slopePct)}</span>
          <span className="mute">RSI 14</span><span className="mono">{t.rsi}</span>
          <span className="mute">MACD histogram</span><span className="mono">{fmtNum(t.macdHist, 4)}</span>
          <span className="mute">ADX (trend strength)</span><span className="mono">{t.adx ?? '—'}</span>
        </div>
      </div>
    );
  }
  if (view === 'meanrev') {
    const m = f.meanReversion;
    const label = { 'extended-above': 'Extended above band', 'upper-half': 'Upper half of range', 'near-mean': 'Near the mean', 'lower-half': 'Lower half of range', 'extended-below': 'Extended below band' }[m.state];
    const col = m.state.startsWith('extended') ? 'var(--warn)' : 'var(--text)';
    const pos = Math.max(0, Math.min(1, m.pctB));
    return (
      <div className="rcard" style={{ padding: 8 }}>
        {head}
        <b style={{ color: col, display: 'block', margin: '4px 0' }}>{label}</b>
        <div style={{ position: 'relative', height: 26, margin: '8px 0', borderRadius: 4, background: 'linear-gradient(90deg, var(--down-soft), var(--line-soft) 30%, var(--line-soft) 70%, var(--up-soft))' }} aria-label={`%B ${m.pctB}`}>
          <div style={{ position: 'absolute', left: `calc(${pos * 100}% - 1px)`, top: -3, bottom: -3, width: 3, borderRadius: 2, background: col }} />
          <span className="mono mute" style={{ position: 'absolute', left: 4, top: 6, fontSize: 10 }}>{fmtNum(m.lower, 2)}</span>
          <span className="mono mute" style={{ position: 'absolute', right: 4, top: 6, fontSize: 10 }}>{fmtNum(m.upper, 2)}</span>
        </div>
        <div className="kv" style={{ fontSize: 11 }}>
          <span className="mute">Z-score vs 20-bar mean</span><span className="mono">{m.zScore}</span>
          <span className="mute">%B</span><span className="mono">{m.pctB}</span>
          <span className="mute">Band width</span><span className="mono">{m.bandwidthPct}% ({m.bandwidthPercentile}th pct)</span>
          <span className="mute">Squeeze</span><span style={{ color: m.squeeze ? 'var(--warn)' : undefined }}>{m.squeeze ? 'Yes: bands unusually narrow' : 'No'}</span>
        </div>
      </div>
    );
  }
  if (view === 'levels') {
    const row = (l: TimeframeAnalysis['levels']['supports'][number], kind: 'R' | 'S') => (
      <tr key={`${kind}${l.price}`}>
        <td style={{ color: kind === 'R' ? 'var(--down)' : 'var(--up)' }}>{kind === 'R' ? 'Resistance' : 'Support'}</td>
        <td className="num mono">{fmtNum(l.price, l.price < 10 ? 4 : 2)}</td>
        <td className="num mono">{fmtPct(l.distancePct)}</td>
        <td className="num mono" title="Swing points in this zone">{l.touches}×</td>
      </tr>
    );
    return (
      <div className="rcard" style={{ padding: 8 }}>
        {head}
        <table className="tbl" style={{ fontSize: 11 }}>
          <thead><tr><th>Zone</th><th className="num">Level</th><th className="num">Distance</th><th className="num">Touches</th></tr></thead>
          <tbody>
            {[...f.levels.resistances].reverse().map((l) => row(l, 'R'))}
            <tr><td colSpan={4} style={{ textAlign: 'center', background: 'var(--panel-alt)' }} className="mono">Price {fmtNum(f.price, f.price < 10 ? 4 : 2)}</td></tr>
            {f.levels.supports.map((l) => row(l, 'S'))}
          </tbody>
        </table>
        {!f.levels.supports.length && !f.levels.resistances.length && <p className="mute" style={{ fontSize: 11 }}>Not enough swing points on this timeframe.</p>}
      </div>
    );
  }
  const s = f.structure;
  const col = s.bias === 'uptrend' ? 'var(--up)' : s.bias === 'downtrend' ? 'var(--down)' : 'var(--text-dim)';
  return (
    <div className="rcard" style={{ padding: 8 }}>
      {head}
      <b style={{ color: col, fontSize: 16, textTransform: 'capitalize', display: 'block', margin: '4px 0' }}>{s.bias}</b>
      <div className="mono" style={{ fontSize: 12, marginBottom: 6 }}>{s.highs ?? '—'} · {s.lows ?? '—'}</div>
      <LineChart ariaLabel={`${TF_NAME[f.tf]} structure`} height={90} lines={[{ name: 'Close', values: f.closes }]} refLines={[...(s.lastSwingHigh != null ? [{ y: s.lastSwingHigh, label: 'swing high' }] : []), ...(s.lastSwingLow != null ? [{ y: s.lastSwingLow, label: 'swing low' }] : [])]} />
      <div className="kv" style={{ fontSize: 11, marginTop: 6 }}>
        <span className="mute">Last swing high</span><span className="mono">{fmtNum(s.lastSwingHigh, 2)}</span>
        <span className="mute">Last swing low</span><span className="mono">{fmtNum(s.lastSwingLow, 2)}</span>
        <span className="mute">Break</span><span style={{ color: s.break ? 'var(--warn)' : undefined }}>{s.break ?? 'None: inside last swing range'}</span>
      </div>
    </div>
  );
}

const VIEW_TITLE: Record<TechView, string> = {
  indicators: 'Technical indicators',
  trend: 'Trend & momentum',
  meanrev: 'Mean reversion (Bollinger 20, 2σ)',
  levels: 'Support & resistance',
  structure: 'Market structure',
};
const VIEW_NOTE: Record<TechView, string> = {
  indicators: 'Readings describe where price sits relative to each indicator.',
  trend: 'Score −100…+100 combines price vs EMA 20/50, EMA alignment and slope, RSI, MACD and 10-bar change.',
  meanrev: 'Z-score and %B measure distance from the 20-bar mean. A squeeze means band width is in its lowest 15% of the last ~120 bars.',
  levels: 'Zones cluster fractal swing highs/lows within ~0.6 ATR. More touches = more often respected in the past.',
  structure: 'HH/HL = higher highs and higher lows; LH/LL = lower highs and lower lows, from the last two swing points.',
};

export function technicalPanel(view: TechView) {
  return function TechnicalPanel({ params, set, report, compact }: PanelProps) {
    const symbol = String(params.symbol ?? '^JKSE');
    const [tab, setTab] = useState(0);
    const { data, error, reload } = useApi<Envelope<TechnicalsResponse>>(`/api/research/technicals?symbol=${encodeURIComponent(symbol)}`, 3 * 60_000);
    useEffect(() => {
      if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: data.data.label });
    }, [data, report]);
    const frames = data?.data.frames ?? [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="toolbar">
          <SymbolField value={symbol} onChange={(s) => set({ symbol: s })} />
          {compact && frames.length > 0 && (
            <div className="seg" role="group" aria-label="Timeframe">
              {frames.map((f, i) => (
                <button key={f.tf} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>{f.tf}</button>
              ))}
            </div>
          )}
          <span className="mute" style={{ fontSize: 11 }}>{VIEW_TITLE[view]}</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
          {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
          {!data && !error && <Loading rows={8} />}
          {data && (
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))' }}>
              {(compact ? frames.slice(tab, tab + 1) : frames).map((f) => (
                <Frame key={f.tf} f={f} view={view} />
              ))}
            </div>
          )}
        </div>
        <div className="disclaimer">{VIEW_NOTE[view]} Descriptive research only, not a buy/sell signal.</div>
      </div>
    );
  };
}
