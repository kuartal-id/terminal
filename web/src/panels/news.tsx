import { useEffect, useMemo, useState } from 'react';
import type { Envelope, NewsItem } from '@shared/types';
import { useApi } from '../lib/api';
import { fmtTimeShort, timeAgo } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import type { PanelProps } from './types';

const TOPICS: [string, string][] = [['', 'All'], ['markets', 'Markets'], ['economy', 'Economy'], ['central-banks', 'Central banks'], ['crypto', 'Crypto']];

export function NewsPanel({ params, set, report }: PanelProps) {
  const region = (params.region as string) ?? 'all';
  const topic = (params.topic as string) ?? '';
  const q = (params.q as string) ?? '';
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);
  const qs = new URLSearchParams();
  if (region !== 'all') qs.set('region', region);
  if (topic) qs.set('topic', topic);
  if (q) qs.set('q', q);
  const { data, error, reload } = useApi<Envelope<NewsItem[]>>(`/api/news?${qs}`, 120_000);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `${data.data.length} headlines` });
  }, [data, report]);
  const now = useMemo(() => Date.now(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Region">
          {[['all', 'ALL'], ['id', 'INDONESIA'], ['global', 'GLOBAL']].map(([k, l]) => (
            <button key={k} className={region === k ? 'on' : ''} onClick={() => set({ region: k })}>
              {l}
            </button>
          ))}
        </div>
        <select className="field" value={topic} onChange={(e) => set({ topic: e.target.value })} aria-label="Topic">
          {TOPICS.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <form
          style={{ flex: 1, minWidth: 100 }}
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: draft.trim() || undefined });
          }}
        >
          <input className="field" style={{ width: '100%' }} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search headlines…" aria-label="Search headlines" />
        </form>
        {q && (
          <button className="chip on" onClick={() => set({ q: undefined })} title="Clear search">
            “{q}” ×
          </button>
        )}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={8} />}
        {data && !data.data.length && <div className="note">No headlines match. Try a different search or region.</div>}
        {data?.data.map((n) => {
          const ageMin = (now - new Date(n.published).getTime()) / 60000;
          return (
            <a key={n.id} className={`news-item ${ageMin < 30 ? 'fresh' : ''}`} href={n.url} target="_blank" rel="noopener noreferrer">
              <time dateTime={n.published} title={new Date(n.published).toLocaleString('en-GB')}>
                {fmtTimeShort(n.published)}
                <br />
                <span style={{ fontSize: 10 }}>{timeAgo(n.published, now)}</span>
              </time>
              <span>
                <span className="h">{n.title}</span>
                <span className="meta" style={{ display: 'block' }}>
                  {n.source} · {n.region === 'id' ? 'ID' : 'GLOBAL'}
                </span>
              </span>
            </a>
          );
        })}
      </div>
      <div className="disclaimer">Headlines link to the original publishers. Kuartal doesn&apos;t host or rewrite articles.</div>
    </div>
  );
}
