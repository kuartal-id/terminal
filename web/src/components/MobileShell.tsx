import { useCallback, useEffect, useRef, useState } from 'react';
import { PANELS, type PanelType } from '../lib/panels';
import { useStore, type Params } from '../lib/store';
import { CommandBar } from './CommandBar';
import { I } from './Icons';
import { PanelFrame } from './PanelFrame';
import { Toast, UserArea } from './Shell';

/**
 * Simplified phone experience: one column, bottom tabs, same panel components.
 * Mobile panels keep their own settings (they don't touch desktop workspaces).
 */

type Tab = 'home' | 'chart' | 'news' | 'watch' | 'more';

const MORE: PanelType[] = ['IDX', 'FX', 'CRY', 'YC', 'MAC', 'CLK', 'CAL', 'COR', 'SEA', 'BOOK', 'ASK', 'HELP'];

function Card({ type, initial = {}, fixed, height }: { type: PanelType; initial?: Params; fixed?: boolean; height?: number }) {
  const [params, setParams] = useState<Params>(initial);
  const onParams = useCallback((patch: Params) => setParams((p) => ({ ...p, ...patch })), []);
  return (
    <div className={fixed ? 'm-card-fixed' : height ? 'm-card-sized' : undefined} style={height ? { height } : undefined}>
      <PanelFrame panel={{ id: `m-${type}`, type, params }} compact onParams={onParams} />
    </div>
  );
}

export function MobileShell() {
  const [tab, setTab] = useState<Tab>('home');
  const [more, setMore] = useState<PanelType | null>(null);
  const focusSymbol = useStore((s) => s.focusSymbol);
  const first = useRef(true);

  // Panels opened from the command bar / Ask Kuartal show up in the More tab.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const type = (e as CustomEvent<{ type: PanelType }>).detail?.type;
      if (!type || !(type in PANELS)) return;
      if (type === 'CHT') return setTab('chart');
      if (type === 'NWS') return setTab('news');
      if (type === 'WL') return setTab('watch');
      setMore(type);
      setTab('more');
    };
    window.addEventListener('kt:open-panel', onOpen);
    return () => window.removeEventListener('kt:open-panel', onOpen);
  }, []);

  // Tapping a symbol anywhere jumps to the chart tab.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTab('chart');
  }, [focusSymbol]);

  return (
    <div className="m-app">
      <header className="m-top">
        <img src="/kuartal-icon-mark.png" alt="Kuartal" />
        <CommandBar placeholder="Search or ask Kuartal…" />
        <UserArea />
      </header>
      <main className="m-body">
        {tab === 'home' && (
          <>
            <Card type="PLS" />
            <Card type="OVR" initial={{ groups: 'Indonesia,Asia,US & Europe,Commodities,Crypto' }} />
          </>
        )}
        {tab === 'chart' && <Card key={focusSymbol} type="CHT" initial={{ symbol: focusSymbol, range: '6M' }} height={440} />}
        {tab === 'news' && <Card type="NWS" fixed />}
        {tab === 'watch' && <Card type="WL" />}
        {tab === 'more' &&
          (more ? (
            <>
              <button className="btn small" style={{ justifySelf: 'start' }} onClick={() => setMore(null)}>
                ← All tools
              </button>
              <Card key={more} type={more} fixed />
            </>
          ) : (
            <div className="m-more">
              {MORE.map((t) => (
                <button key={t} onClick={() => setMore(t)}>
                  <b>
                    <span className="mono" style={{ color: 'var(--accent)' }}>{t}</span> {PANELS[t].title}
                  </b>
                  <span>
                    {PANELS[t].description}
                    {PANELS[t].pro ? ' · PRO' : ''}
                  </span>
                </button>
              ))}
            </div>
          ))}
      </main>
      <nav className="m-nav" aria-label="Sections">
        {(
          [
            ['home', 'Markets', I.pulse],
            ['chart', 'Chart', I.chart],
            ['news', 'News', I.news],
            ['watch', 'Watchlist', I.star],
            ['more', 'More', I.grid],
          ] as const
        ).map(([k, label, Icon]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} aria-current={tab === k ? 'page' : undefined}>
            <Icon />
            {label}
          </button>
        ))}
      </nav>
      <Toast />
    </div>
  );
}
