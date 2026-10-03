import { useEffect, useState } from 'react';
import type { CorrelationMatrix, Envelope, Seasonality } from '@shared/types';
import { resolveInstrument } from '@shared/instruments';
import { useApi } from '../lib/api';
import { fmtPct } from '../lib/format';
import { ErrorBox, Loading, ProGate } from '../components/bits';
import type { PanelProps } from './types';

function corrColor(v: number): string {
  if (!isFinite(v)) return 'transparent';
  const a = Math.min(1, Math.abs(v));
  return v >= 0 ? `rgba(54, 204, 100, ${0.1 + a * 0.75})` : `rgba(255, 100, 100, ${0.1 + a * 0.75})`;
}

const DEFAULT_SET = '^JKSE,IDR=X,^GSPC,GC=F,BZ=F,MTF=F,BTCUSDT,^TNX';

// ───────────── COR · Correlation (PRO) ─────────────

function CorrelationInner({ params, set, report }: PanelProps) {
  const symbols = String(params.symbols ?? DEFAULT_SET);
  const window = Number(params.window ?? 60);
  const [adding, setAdding] = useState('');
  const { data, error, reload } = useApi<Envelope<CorrelationMatrix>>(`/api/pro/correlation?symbols=${encodeURIComponent(symbols)}&window=${window}`);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `${window}D daily returns` });
  }, [data, report, window]);
  const list = symbols.split(',');
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const inst = resolveInstrument(adding);
    if (inst && !list.includes(inst.symbol)) set({ symbols: [...list, inst.symbol].slice(-12).join(',') });
    setAdding('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Window">
          {[20, 60, 120, 250].map((w) => (
            <button key={w} className={w === window ? 'on' : ''} onClick={() => set({ window: w })}>
              {w}D
            </button>
          ))}
        </div>
        <form onSubmit={add} style={{ display: 'flex', gap: 4 }}>
          <input className="field mono" style={{ width: 110 }} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="+ symbol" aria-label="Add symbol" />
        </form>
        <button className="btn small" onClick={() => set({ symbols: DEFAULT_SET })}>Reset</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={6} />}
        {data && (
          <table className="tbl mono" style={{ fontSize: 11, width: 'auto' }}>
            <thead>
              <tr>
                <th />
                {data.data.labels.map((l) => (
                  <th key={l} className="num">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.matrix.map((row, i) => (
                <tr key={data.data.symbols[i]}>
                  <td>
                    <b>{data.data.labels[i]}</b>{' '}
                    <button
                      className="icon-btn"
                      style={{ width: 16, height: 16, fontSize: 10 }}
                      title="Remove"
                      aria-label={`Remove ${data.data.labels[i]}`}
                      onClick={() => set({ symbols: list.filter((s) => (resolveInstrument(s)?.symbol ?? s) !== data.data.symbols[i]).join(',') })}
                    >
                      ×
                    </button>
                  </td>
                  {row.map((v, j) => (
                    <td key={j} className="num" style={{ background: i === j ? 'var(--panel-alt)' : corrColor(v), color: i === j ? 'var(--text-mute)' : undefined, minWidth: 52 }} title={`${data.data.labels[i]} × ${data.data.labels[j]}: ${isFinite(v) ? v.toFixed(2) : 'n/a'}`}>
                      {isFinite(v) ? v.toFixed(2) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="disclaimer">Pearson correlation of daily returns on dates all markets traded. Correlations change over time — check several windows.</div>
    </div>
  );
}

export function CorrelationPanel(props: PanelProps) {
  return (
    <ProGate type="COR">
      <CorrelationInner {...props} />
    </ProGate>
  );
}

// ───────────── SEA · Seasonality (PRO) ─────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function SeasonalityInner({ params, set, report }: PanelProps) {
  const symbol = String(params.symbol ?? '^JKSE');
  const inst = resolveInstrument(symbol)!;
  const [input, setInput] = useState('');
  const { data, error, reload } = useApi<Envelope<Seasonality>>(`/api/pro/seasonality?symbol=${encodeURIComponent(inst.symbol)}`);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: inst.label });
  }, [data, report, inst.label]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = resolveInstrument(input);
    if (r) set({ symbol: r.symbol });
    setInput('');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <form onSubmit={submit}>
          <input className="field mono" style={{ width: 120 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder={inst.label} aria-label="Symbol" />
        </form>
        <span className="mute" style={{ fontSize: 11 }}>Monthly % returns, last ~15 years</span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {data && (
          <table className="tbl mono" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>Year</th>
                {MONTHS.map((m) => (
                  <th key={m} className="num">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ fontWeight: 700 }}>
                <td>AVG</td>
                {data.data.average.map((v, i) => (
                  <td key={i} className={`num ${v == null ? '' : v >= 0 ? 'up' : 'down'}`}>{v == null ? '' : fmtPct(v, 1, false)}</td>
                ))}
              </tr>
              <tr>
                <td className="mute">% UP</td>
                {data.data.hitRate.map((v, i) => (
                  <td key={i} className="num mute">{v == null ? '' : `${v}%`}</td>
                ))}
              </tr>
              {data.data.rows.map((r) => (
                <tr key={r.year}>
                  <td>{r.year}</td>
                  {r.months.map((v, i) => (
                    <HeatCell key={i} v={v} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="disclaimer">Past seasonal patterns don&apos;t predict future returns. Research aid only.</div>
    </div>
  );
}

function HeatCell({ v }: { v: number | null }) {
  return (
    <td className="num" style={{ background: v == null ? undefined : corrColor(Math.max(-1, Math.min(1, v / 8))) }}>
      {v == null ? '' : v.toFixed(1)}
    </td>
  );
}

export function SeasonalityPanel(props: PanelProps) {
  return (
    <ProGate type="SEA">
      <SeasonalityInner {...props} />
    </ProGate>
  );
}
