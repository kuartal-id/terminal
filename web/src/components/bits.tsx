import type { ReactNode } from 'react';
import type { DataSource } from '@shared/types';
import { PANELS, type PanelType } from '../lib/panels';
import { useStore } from '../lib/store';
import { useMe } from '../lib/me';
import { I } from './Icons';

const SRC_LABEL: Record<DataSource, string> = { live: 'LIVE', delayed: 'DELAYED', eod: 'EOD', static: 'ANNUAL', demo: 'DEMO' };
const SRC_TITLE: Record<DataSource, string> = {
  live: 'Real-time data',
  delayed: 'Delayed data (typically ~15 minutes for exchanges)',
  eod: 'End-of-day / daily reference data',
  static: 'Official statistics, updated periodically',
  demo: 'Illustrative DEMO data — the live source was unreachable. Not real prices.',
};

export function SourceBadge({ source }: { source?: DataSource }) {
  if (!source) return null;
  return (
    <span className={`src ${source}`} title={SRC_TITLE[source]}>
      {SRC_LABEL[source]}
    </span>
  );
}

export function Sparkline({ values, width = 80, height = 22, className }: { values?: number[]; width?: number; height?: number; className?: string }) {
  if (!values || values.length < 2) return <span style={{ display: 'inline-block', width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline points={pts} fill="none" stroke={up ? 'var(--up)' : 'var(--down)'} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="errbox">
      {message}{' '}
      {onRetry && (
        <button className="btn small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function SymbolButton({ symbol, label, className }: { symbol: string; label: string; className?: string }) {
  const focus = useStore((s) => s.focus);
  return (
    <button
      type="button"
      className={className ?? 'sym'}
      onClick={() => focus(symbol)}
      title={`Send ${label} to linked charts`}
      style={{ border: 0, background: 'transparent', padding: 0 }}
    >
      {label}
    </button>
  );
}

/** Wraps PRO panel bodies: shows an upgrade/login card unless the user is entitled. */
export function ProGate({ type, children }: { type: PanelType; children: ReactNode }) {
  const me = useMe();
  if (!PANELS[type].pro || me?.tier === 'pro') return <>{children}</>;
  const meta = PANELS[type];
  return (
    <div className="gate">
      <div>
        <div className="lock" aria-hidden>
          <I.lock width={26} height={26} />
        </div>
        <h3>{meta.title} is a Kuartal Pro panel</h3>
        <p>{meta.description}. {me?.authenticated ? 'Your Kuartal ID is on the Free plan.' : 'Log in with your Kuartal ID — Pro members unlock it instantly.'}</p>
        {me?.authenticated ? (
          <a className="btn primary" href={me.upgradeUrl} target="_blank" rel="noreferrer">
            See Kuartal Pro
          </a>
        ) : me?.authConfigured ? (
          <a className="btn primary" href={`${me.loginUrl}?returnTo=${encodeURIComponent(location.pathname)}`}>
            Log in with Kuartal ID
          </a>
        ) : (
          <p className="mute" style={{ fontSize: 11 }}>Kuartal ID login is not configured on this server yet.</p>
        )}
      </div>
    </div>
  );
}
