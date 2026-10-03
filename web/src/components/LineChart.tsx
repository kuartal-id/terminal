import { useMemo, useState } from 'react';

/**
 * Lightweight responsive SVG line chart for non-time-series or annual data
 * (yield curves, macro). Time-series price charts use lightweight-charts.
 */

export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number | null }[];
  dashed?: boolean;
}

const PALETTE = ['#36cc64', '#5cb8d6', '#f5b942', '#c38cf0', '#ff8a65', '#9ccc65', '#4dd0e1', '#f06292'];
export const seriesColor = (i: number) => PALETTE[i % PALETTE.length];

export function LineChart({
  series,
  height = 220,
  xLabel = (x: number) => String(x),
  yFormat = (y: number) => y.toFixed(2),
  xTicks,
  zeroLine = true,
}: {
  series: Series[];
  height?: number;
  xLabel?: (x: number) => string;
  yFormat?: (y: number) => string;
  xTicks?: number[];
  zeroLine?: boolean;
}) {
  const W = 640;
  const H = height;
  const pad = { l: 44, r: 12, t: 10, b: 24 };
  const [hover, setHover] = useState<number | null>(null);

  const { xs, minX, maxX, minY, maxY } = useMemo(() => {
    const allX = series.flatMap((s) => s.points.map((p) => p.x));
    const allY = series.flatMap((s) => s.points.map((p) => p.y).filter((y): y is number => y != null));
    const xs = [...new Set(allX)].sort((a, b) => a - b);
    let minY = Math.min(...allY);
    let maxY = Math.max(...allY);
    if (zeroLine && minY > 0 && minY / (maxY || 1) < 0.3) minY = 0;
    const padY = (maxY - minY) * 0.08 || 1;
    return { xs, minX: Math.min(...allX), maxX: Math.max(...allX), minY: minY - padY, maxY: maxY + padY };
  }, [series, zeroLine]);

  if (!xs.length || !isFinite(minY)) return <div className="note">No data.</div>;

  const sx = (x: number) => pad.l + ((x - minX) / (maxX - minX || 1)) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - (y - minY) / (maxY - minY || 1)) * (H - pad.t - pad.b);
  const yTicks = Array.from({ length: 5 }, (_, i) => minY + ((maxY - minY) * i) / 4);
  const ticks = xTicks ?? (xs.length <= 12 ? xs : xs.filter((_, i) => i % Math.ceil(xs.length / 8) === 0));

  const path = (s: Series) => {
    let d = '';
    let pen = false;
    for (const p of s.points) {
      if (p.y == null) {
        pen = false;
        continue;
      }
      d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = xs[0];
    for (const v of xs) if (Math.abs(sx(v) - x) < Math.abs(sx(best) - x)) best = v;
    setHover(best);
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke="var(--line-soft)" />
            <text x={pad.l - 6} y={sy(t) + 3} textAnchor="end" fontSize="10" fill="var(--text-mute)" fontFamily="var(--font-mono)">
              {yFormat(t)}
            </text>
          </g>
        ))}
        {zeroLine && minY < 0 && maxY > 0 && <line x1={pad.l} x2={W - pad.r} y1={sy(0)} y2={sy(0)} stroke="var(--text-mute)" strokeDasharray="3 3" />}
        {ticks.map((t) => (
          <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text-mute)" fontFamily="var(--font-mono)">
            {xLabel(t)}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.name} d={path(s)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
        ))}
        {hover != null && (
          <>
            <line x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--text-mute)" strokeDasharray="2 3" />
            {series.map((s) => {
              const p = s.points.find((q) => q.x === hover);
              return p?.y != null ? <circle key={s.name} cx={sx(hover)} cy={sy(p.y)} r={3.5} fill={s.color} stroke="var(--panel)" strokeWidth="1.5" /> : null;
            })}
          </>
        )}
      </svg>
      {hover != null && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: sx(hover) / W > 0.6 ? 54 : undefined,
            right: sx(hover) / W > 0.6 ? undefined : 14,
            background: 'var(--bg-raised)',
            border: '1px solid var(--line)',
            borderRadius: 6,
            padding: '6px 8px',
            fontSize: 11,
            pointerEvents: 'none',
            fontFamily: 'var(--font-mono)',
            boxShadow: 'var(--shadow)',
          }}
        >
          <div className="mute">{xLabel(hover)}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.x === hover);
            return (
              <div key={s.name} style={{ color: s.color }}>
                {s.name}: {p?.y != null ? yFormat(p.y) : '—'}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', padding: '2px 4px 0 44px', fontSize: 11 }}>
        {series.map((s) => (
          <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 12, height: 3, background: s.color, borderRadius: 2, display: 'inline-block', opacity: s.dashed ? 0.6 : 1 }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
