import { useEffect, useId, useMemo, useRef, useState } from 'react';

/** Track an element's pixel width so SVGs draw at true size (no squashed text). */
function useWidth(fallback = 600): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(120, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/**
 * Small dependency-free SVG charts for research panels. They scale to their
 * container (viewBox + width 100%), use theme tokens, and stay legible at
 * phone width. For full interactive price charts use lightweight-charts (CHT).
 */

export const SERIES_COLORS = ['var(--accent)', 'var(--info)', 'var(--warn)', '#c58cf0', '#ff8f6b', '#7ad1c0', '#e6d36a', '#8fa6ff'];

interface Line {
  name: string;
  values: (number | null)[];
  color?: string;
  dashed?: boolean;
}

const fmtAxis = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${(v / 1e3).toFixed(0)}k`;
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return v.toFixed(2);
  return v.toFixed(3);
};

export function LineChart(props: { lines: Line[]; height?: number; labels?: string[]; zero?: boolean; refLines?: { y: number; label?: string }[]; ariaLabel: string }) {
  const [ref, w] = useWidth();
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
      <LineChartSvg {...props} width={w} />
    </div>
  );
}

function LineChartSvg({ lines, height = 160, labels, zero, refLines, ariaLabel, width }: { lines: Line[]; height?: number; labels?: string[]; zero?: boolean; refLines?: { y: number; label?: string }[]; ariaLabel: string; width: number }) {
  const W = width;
  const H = height;
  const pad = { l: 46, r: 8, t: 8, b: labels ? 18 : 6 };
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v != null && isFinite(v)));
  const refs = refLines?.map((r) => r.y) ?? [];
  if (!all.length) return <div className="mute" style={{ padding: 12, fontSize: 12 }}>No data</div>;
  let lo = Math.min(...all, ...refs, ...(zero ? [0] : []));
  let hi = Math.max(...all, ...refs, ...(zero ? [0] : []));
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.05;
  hi += span * 0.05;
  const n = Math.max(...lines.map((l) => l.values.length));
  const x = (i: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--text-mute)" fontFamily="var(--font-mono)">{fmtAxis(t)}</text>
        </g>
      ))}
      {zero && lo < 0 && hi > 0 && <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="var(--text-mute)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
      {refLines?.map((r, i) => (
        <g key={`r${i}`}>
          <line x1={pad.l} x2={W - pad.r} y1={y(r.y)} y2={y(r.y)} stroke="var(--warn)" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
          {r.label && <text x={W - pad.r - 2} y={y(r.y) - 3} textAnchor="end" fontSize={10} fill="var(--warn)">{r.label}</text>}
        </g>
      ))}
      {lines.map((l, k) => {
        let d = '';
        l.values.forEach((v, i) => {
          if (v == null || !isFinite(v)) return;
          d += `${d && l.values[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        });
        return <path key={l.name} d={d} fill="none" stroke={l.color ?? SERIES_COLORS[k % SERIES_COLORS.length]} strokeWidth={1.6} strokeDasharray={l.dashed ? '4 3' : undefined} vectorEffect="non-scaling-stroke" />;
      })}
      {labels && labels.length > 1 && (
        <>
          <text x={pad.l} y={H - 4} fontSize={10} fill="var(--text-mute)">{labels[0]}</text>
          <text x={W - pad.r} y={H - 4} fontSize={10} fill="var(--text-mute)" textAnchor="end">{labels[labels.length - 1]}</text>
        </>
      )}
    </svg>
  );
}

export function Legend({ items }: { items: { name: string; color?: string; value?: string }[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, padding: '4px 8px' }}>
      {items.map((it, i) => (
        <span key={it.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 10, height: 3, borderRadius: 2, background: it.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }} />
          <span className="dim">{it.name}</span>
          {it.value && <b className="mono">{it.value}</b>}
        </span>
      ))}
    </div>
  );
}

export function Histogram({ bins, height = 120, ariaLabel, markAt }: { bins: { label: string; count: number }[]; height?: number; ariaLabel: string; markAt?: number }) {
  const [ref, W] = useWidth();
  const max = Math.max(1, ...bins.map((b) => b.count));
  const bw = W / bins.length;
  return (
    <div ref={ref} style={{ width: '100%', minWidth: 0 }}>
    <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" aria-label={ariaLabel} style={{ display: 'block' }}>
      {bins.map((b, i) => {
        const h = (b.count / max) * (height - 16);
        return (
          <rect key={i} x={i * bw + 1} y={height - 14 - h} width={bw - 2} height={h} fill={markAt != null && i === markAt ? 'var(--warn)' : i < bins.length / 2 ? 'var(--down)' : 'var(--up)'} opacity={0.75}>
            <title>{`${b.label}: ${b.count}`}</title>
          </rect>
        );
      })}
      <text x={2} y={height - 2} fontSize={10} fill="var(--text-mute)">{bins[0]?.label}</text>
      <text x={W - 2} y={height - 2} fontSize={10} fill="var(--text-mute)" textAnchor="end">{bins[bins.length - 1]?.label}</text>
    </svg>
    </div>
  );
}

export function Scatter({ points, slope, height = 200, xLabel, yLabel }: { points: { x: number; y: number }[]; slope?: number; height?: number; xLabel: string; yLabel: string }) {
  const W = 400;
  const H = height;
  const pad = 28;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const m = Math.max(0.01, ...xs.map(Math.abs), ...ys.map(Math.abs)) * 1.05;
  const sx = (v: number) => pad + ((v + m) / (2 * m)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v + m) / (2 * m)) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Scatter of ${yLabel} vs ${xLabel} daily returns`}>
      <line x1={sx(-m)} x2={sx(m)} y1={sy(0)} y2={sy(0)} stroke="var(--line)" />
      <line x1={sx(0)} x2={sx(0)} y1={sy(-m)} y2={sy(m)} stroke="var(--line)" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={2} fill="var(--info)" opacity={0.55} />
      ))}
      {slope != null && <line x1={sx(-m)} y1={sy(-m * slope)} x2={sx(m)} y2={sy(m * slope)} stroke="var(--accent)" strokeWidth={2} />}
      <text x={W - pad} y={sy(0) - 4} fontSize={10} fill="var(--text-mute)" textAnchor="end">{xLabel} %</text>
      <text x={sx(0) + 4} y={pad - 6} fontSize={10} fill="var(--text-mute)">{yLabel} %</text>
    </svg>
  );
}

const QUAD = {
  leading: 'var(--up)',
  weakening: 'var(--warn)',
  lagging: 'var(--down)',
  improving: 'var(--info)',
} as const;

export function RotationMap({ rows, height = 300 }: { rows: { label: string; tail: { rsRatio: number; rsMomentum: number; quadrant: keyof typeof QUAD }[] }[]; height?: number }) {
  const id = useId();
  const pts = rows.flatMap((r) => r.tail);
  const W = 420;
  const H = height;
  const pad = 24;
  const ext = useMemo(() => {
    const dx = Math.max(1.5, ...pts.map((p) => Math.abs(p.rsRatio - 100))) * 1.15;
    const dy = Math.max(1.5, ...pts.map((p) => Math.abs(p.rsMomentum - 100))) * 1.15;
    return { dx, dy };
  }, [pts]);
  const sx = (v: number) => pad + ((v - 100 + ext.dx) / (2 * ext.dx)) * (W - 2 * pad);
  const sy = (v: number) => H - pad - ((v - 100 + ext.dy) / (2 * ext.dy)) * (H - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Relative rotation map">
      <defs>
        <marker id={`${id}-a`} viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
          <circle cx="3" cy="3" r="3" fill="currentColor" />
        </marker>
      </defs>
      <rect x={sx(100)} y={pad} width={W - pad - sx(100)} height={sy(100) - pad} fill="var(--up-soft)" />
      <rect x={sx(100)} y={sy(100)} width={W - pad - sx(100)} height={H - pad - sy(100)} fill="var(--warn-soft)" />
      <rect x={pad} y={sy(100)} width={sx(100) - pad} height={H - pad - sy(100)} fill="var(--down-soft)" />
      <rect x={pad} y={pad} width={sx(100) - pad} height={sy(100) - pad} fill="var(--info-soft)" />
      <text x={W - pad - 4} y={pad + 12} textAnchor="end" fontSize={10} fill="var(--up)">LEADING</text>
      <text x={W - pad - 4} y={H - pad - 4} textAnchor="end" fontSize={10} fill="var(--warn)">WEAKENING</text>
      <text x={pad + 4} y={H - pad - 4} fontSize={10} fill="var(--down)">LAGGING</text>
      <text x={pad + 4} y={pad + 12} fontSize={10} fill="var(--info)">IMPROVING</text>
      {rows.map((r) => {
        if (!r.tail.length) return null;
        const last = r.tail[r.tail.length - 1];
        const col = QUAD[last.quadrant];
        const d = r.tail.map((p, i) => `${i ? 'L' : 'M'}${sx(p.rsRatio).toFixed(1)},${sy(p.rsMomentum).toFixed(1)}`).join('');
        return (
          <g key={r.label} style={{ color: col }}>
            <path d={d} fill="none" stroke={col} strokeWidth={1.3} opacity={0.7} markerEnd={`url(#${id}-a)`} />
            <text x={sx(last.rsRatio) + 5} y={sy(last.rsMomentum) - 4} fontSize={10} fill="var(--text)">{r.label}</text>
          </g>
        );
      })}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-mute)">Relative trend (RS-Ratio) →</text>
    </svg>
  );
}

export function ScoreBar({ score, label, invert }: { score: number; label?: string; invert?: boolean }) {
  // 0–100. invert: high = bad (stress gauges) → red at the top.
  const hot = invert ? score : 100 - score;
  const color = hot >= 65 ? 'var(--down)' : hot >= 40 ? 'var(--warn)' : 'var(--up)';
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b style={{ fontFamily: 'var(--font-display)', fontSize: 18, color }}>{label}</b>
        <span className="mono" style={{ fontSize: 22, fontWeight: 700, color }}>{score}</span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--line-soft)', overflow: 'hidden' }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={label}>
        <div style={{ width: `${score}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}
