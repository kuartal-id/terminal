import { useEffect, useState } from 'react';
import type { Envelope, PulseComponent, PulseReport, PulseRegime } from '@shared/types';
import { useApi } from '../lib/api';
import { ErrorBox, Loading } from '../components/bits';
import type { PanelProps } from './types';

const REGIME_COLOR: Record<PulseRegime, string> = {
  'Risk-Off': 'var(--down)',
  Cautious: '#ff9f5a',
  Neutral: 'var(--warn)',
  Constructive: '#9ccc65',
  'Risk-On': 'var(--up)',
};

function colorFor(score: number) {
  return score < 30 ? REGIME_COLOR['Risk-Off'] : score < 45 ? REGIME_COLOR.Cautious : score <= 55 ? REGIME_COLOR.Neutral : score <= 70 ? REGIME_COLOR.Constructive : REGIME_COLOR['Risk-On'];
}

function Gauge({ score, regime, label }: { score: number; regime: PulseRegime; label: string }) {
  // Semi-circle gauge
  const r = 70;
  const cx = 90;
  const cy = 86;
  const a = Math.PI * (1 - score / 100);
  const nx = cx + r * Math.cos(a);
  const ny = cy - r * Math.sin(a);
  const arc = (from: number, to: number) => {
    const a1 = Math.PI * (1 - from / 100);
    const a2 = Math.PI * (1 - to / 100);
    return `M${cx + r * Math.cos(a1)},${cy - r * Math.sin(a1)} A${r},${r} 0 0 1 ${cx + r * Math.cos(a2)},${cy - r * Math.sin(a2)}`;
  };
  return (
    <div className="gauge">
      <div className="section-label" style={{ textAlign: 'center' }}>{label}</div>
      <svg viewBox="0 0 180 100" width="100%" style={{ maxWidth: 220 }} role="img" aria-label={`${label}: ${score} of 100, ${regime}`}>
        {[[0, 30, 'Risk-Off'], [30, 45, 'Cautious'], [45, 55, 'Neutral'], [55, 70, 'Constructive'], [70, 100, 'Risk-On']].map(([f, t, k]) => (
          <path key={k as string} d={arc(f as number, t as number)} stroke={REGIME_COLOR[k as PulseRegime]} strokeWidth="10" fill="none" opacity={0.85} />
        ))}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="var(--text)" />
      </svg>
      <div className="score" style={{ color: colorFor(score) }}>{score}</div>
      <div className="regime" style={{ color: colorFor(score) }}>{regime}</div>
    </div>
  );
}

function Bars({ items }: { items: PulseComponent[] }) {
  return (
    <div className="bars">
      {items.map((c) => (
        <div className="bar-row" key={c.key} title={c.reading}>
          <span className="lbl">
            {c.label} <span className="mute">· {Math.round(c.weight * 100)}%</span>
          </span>
          <span className="track">
            <span className="fill" style={{ width: `${c.score}%`, background: colorFor(c.score) }} />
          </span>
          <span className="mono num">{c.score}</span>
        </div>
      ))}
    </div>
  );
}

export function PulsePanel({ report }: PanelProps) {
  const { data, error, reload } = useApi<Envelope<PulseReport>>('/api/pulse', 5 * 60_000);
  const [lens, setLens] = useState<'global' | 'id'>('global');
  const [showMethod, setShowMethod] = useState(false);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `${data.data.regime} · ${data.data.score}` });
  }, [data, report]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  const p = data.data;
  const view = lens === 'global' ? { score: p.score, regime: p.regime, components: p.components, label: 'Global risk appetite' } : { ...p.indonesia, label: 'Indonesia lens' };
  return (
    <div>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Lens">
          <button className={lens === 'global' ? 'on' : ''} onClick={() => setLens('global')}>GLOBAL</button>
          <button className={lens === 'id' ? 'on' : ''} onClick={() => setLens('id')}>INDONESIA</button>
        </div>
        <span className="mute" style={{ fontSize: 11 }}>
          Global <b className="mono" style={{ color: colorFor(p.score) }}>{p.score}</b> · Indonesia <b className="mono" style={{ color: colorFor(p.indonesia.score) }}>{p.indonesia.score}</b>
        </span>
        <button className="btn small" style={{ marginLeft: 'auto' }} onClick={() => setShowMethod((v) => !v)}>
          {showMethod ? 'Hide' : 'How it works'}
        </button>
      </div>
      {data.note && <div className="note" style={{ color: 'var(--warn)', paddingBottom: 0 }}>{data.note}</div>}
      <div className="pulse">
        <Gauge score={view.score} regime={view.regime} label={view.label} />
        <Bars items={view.components} />
      </div>
      <div className="narr">
        {p.narrative.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
      </div>
      {showMethod && <div className="disclaimer" style={{ fontSize: 11 }}>{p.methodology}</div>}
      <div className="disclaimer">Kuartal Pulse is a research aid built from public market data. It is not investment advice or a buy/sell signal.</div>
    </div>
  );
}
