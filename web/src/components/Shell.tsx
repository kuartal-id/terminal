import { useEffect, useState } from 'react';
import { MARKETS } from '@shared/instruments';
import { dirClass, fmtPct, fmtPrice } from '../lib/format';
import { useMe } from '../lib/me';
import { CATEGORIES, PANELS, PANEL_ORDER, type Category } from '../lib/panels';
import { useStore } from '../lib/store';
import { useQuoteMap } from '../panels/markets';
import { CommandBar } from './CommandBar';
import { I } from './Icons';
import { Workspace } from './Workspace';
import { ResearchPage, type PageKey } from './ResearchPage';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = (tz: string) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: tz === 'Asia/Jakarta' ? '2-digit' : undefined });
  return (
    <div className="clock" aria-label="World clock">
      <span>
        <b>WIB</b>
        {fmt('Asia/Jakarta')}
      </span>
      <span className="opt">
        <b>WITA</b>
        {fmt('Asia/Makassar')}
      </span>
      <span className="opt">
        <b>LDN</b>
        {fmt('Europe/London')}
      </span>
      <span>
        <b>NY</b>
        {fmt('America/New_York')}
      </span>
    </div>
  );
}

function UserArea() {
  const me = useMe();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <>
      <button className="icon-btn" title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <I.sun width={16} height={16} /> : <I.moon width={16} height={16} />}
      </button>
      {me?.authenticated ? (
        <div className="user-chip">
          <span className={`tier ${me.tier === 'pro' ? 'pro' : ''}`}>{me.tier}</span>
          <span className="avatar" title={me.email}>{(me.name ?? me.email ?? '?').slice(0, 1).toUpperCase()}</span>
          <a className="btn small" href={me.logoutUrl}>Log out</a>
        </div>
      ) : me?.authConfigured ? (
        <a className="btn primary" href={`${me.loginUrl}?returnTo=${encodeURIComponent(location.pathname)}`}>
          <I.user width={14} height={14} /> Log in with Kuartal ID
        </a>
      ) : (
        <span className="tier" title="Kuartal ID login is not configured on this server yet">{me?.tier === 'pro' ? 'DEV PRO' : 'GUEST'}</span>
      )}
    </>
  );
}

const CAT_ICON: Record<Category, (p: React.SVGProps<SVGSVGElement>) => React.ReactElement> = {
  Markets: I.chart,
  Indonesia: I.flag,
  Macro: I.globe,
  Crypto: I.coin,
  Analytics: I.matrix,
  Tools: I.calc,
};

const CAT_SHORT: Record<Category, string> = { Markets: 'MKTS', Indonesia: 'INDO', Macro: 'MACRO', Crypto: 'CRYPTO', Analytics: 'ANLYT', Tools: 'TOOLS' };

function Rail() {
  const openPanel = useStore((s) => s.openPanel);
  const [openCat, setOpenCat] = useState<Category | null>(null);
  return (
    <nav className="rail" aria-label="Panels">
      <button onClick={() => openPanel('PLS', {}, { reuse: true })} title="Kuartal Pulse"><I.pulse />PULSE</button>
      <button onClick={() => openPanel('ASK', {}, { reuse: true })} title="Ask Kuartal — coming soon"><I.spark />ASK</button>
      <hr />
      {CATEGORIES.map((c) => {
        const Icon = CAT_ICON[c];
        return (
          <div key={c} className="rail-group">
            <button className={openCat === c ? 'on' : ''} onClick={() => setOpenCat(openCat === c ? null : c)} title={c} aria-expanded={openCat === c}>
              <Icon />{CAT_SHORT[c]}
            </button>
            {openCat === c && (
              <div className="rail-flyout" role="menu" aria-label={c}>
                <div className="cmd-section">{c}</div>
                {PANEL_ORDER.filter((t) => PANELS[t].category === c).map((t) => (
                  <button key={t} className="cmd-item" onClick={() => { openPanel(t); setOpenCat(null); }}>
                    <span className="code">{t}</span>
                    <span className="label">{PANELS[t].title}</span>
                    <span className="hint">{PANELS[t].pro ? 'PRO' : 'OPEN'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <hr />
      <button onClick={() => openPanel('HUB', {}, { reuse: true })} title="Asset classes"><I.grid />ASSET</button>
      <button onClick={() => openPanel('HELP', {}, { reuse: true })} title="Terminal guide"><I.help />GUIDE</button>
    </nav>
  );
}

function Tabs() {
  const workspaces = useStore((s) => s.workspaces);
  const activeId = useStore((s) => s.activeId);
  const setActive = useStore((s) => s.setActive);
  const addWorkspace = useStore((s) => s.addWorkspace);
  const removeWorkspace = useStore((s) => s.removeWorkspace);
  const renameWorkspace = useStore((s) => s.renameWorkspace);
  const resetActive = useStore((s) => s.resetActive);
  const openPanel = useStore((s) => s.openPanel);
  return (
    <div className="tabs" role="tablist">
      {workspaces.map((w) => (
        <button
          key={w.id}
          role="tab"
          aria-selected={w.id === activeId}
          className={`tab ${w.id === activeId ? 'on' : ''}`}
          onClick={() => setActive(w.id)}
          onDoubleClick={() => {
            const name = prompt('Rename workspace', w.name);
            if (name) renameWorkspace(w.id, name);
          }}
          title="Double-click to rename"
        >
          {w.name}
          {workspaces.length > 1 && (
            <span
              className="x"
              role="button"
              aria-label={`Close ${w.name}`}
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Close workspace “${w.name}”?`)) removeWorkspace(w.id);
              }}
            >
              ×
            </span>
          )}
        </button>
      ))}
      <button className="tab" onClick={() => addWorkspace('blank')} title="New workspace" aria-label="New workspace">
        <I.plus width={14} height={14} />
      </button>
      <div className="tab-tools">
        <button className="btn small" onClick={() => resetActive()} title="Restore this workspace's default panels">
  <I.reset width={12} height={12} /> Reset
</button>
<button className="btn small" onClick={() => openPanel('HUB', {}, { reuse: true })} title="Browse all asset classes">
  <I.grid width={12} height={12} /> Asset classes
</button>
      </div>
    </div>
  );
}

function PageNav({ page, setPage }: { page: PageKey | 'dashboard'; setPage: (p: PageKey | 'dashboard') => void }) {
  const items: Array<[PageKey | 'dashboard', string]> = [
    ['dashboard', 'Dashboard'], ['global', 'Global Markets'], ['markets', 'Markets'], ['indonesia', 'Indonesia'], ['fixed-income', 'Bonds & Rates'],
    ['macro', 'Macro'], ['crypto', 'Digital Assets'], ['research', 'Research'], ['tools', 'Tools'],
  ];
  return <nav className="page-nav" aria-label="Terminal pages">
    {items.map(([key, label]) => <button key={key} className={page === key ? 'on' : ''} onClick={() => {
      setPage(key);
      history.replaceState(null, '', key === 'dashboard' ? location.pathname : `#${key}`);
    }}>{label}</button>)}
  </nav>;
}

const TAPE = ['^JKSE', 'IDR=X', 'GC=F', 'BZ=F', 'MTF=F', '^GSPC', '^IXIC', '^N225', '^HSI', 'DX-Y.NYB', '^TNX', 'BTCUSDT', 'ETHUSDT', 'BBCA.JK', 'BBRI.JK', 'TLKM.JK'];

function TickerTape() {
  const { map, data } = useQuoteMap(TAPE, 60_000);
  const focus = useStore((s) => s.focus);
  const items = TAPE.map((s) => map.get(s)).filter(Boolean);
  const label = (s: string) => MARKETS.find((m) => m.symbol === s)?.label ?? s.replace('.JK', '');
  const row = items.map((q) => (
    <button key={q!.symbol} onClick={() => focus(q!.symbol)}>
      <b>{label(q!.symbol)}</b>
      {q!.assetClass === 'rate' ? `${q!.price.toFixed(3)}%` : fmtPrice(q!.price, q!.currency)} <span className={dirClass(q!.changePct)}>{fmtPct(q!.changePct)}</span>
    </button>
  ));
  return (
    <div className="tape" aria-label="Ticker tape">
      <span className="tape-label">KUARTAL</span>
      {data ? (
        <div className="tape-viewport">
          <div className="tape-track">
            {row}
            <span aria-hidden style={{ display: 'contents' }}>{row}</span>
          </div>
        </div>
      ) : (
        <span className="mute" style={{ paddingLeft: 12 }}>Loading markets…</span>
      )}
    </div>
  );
}

function Toast() {
  const toast = useStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      {toast.text}
    </div>
  );
}

export function DesktopShell() {
  const [page, setPage] = useState<PageKey | 'dashboard'>(() => {
    const key = location.hash.replace('#', '') as PageKey;
    return key && ['global','markets','indonesia','fixed-income','macro','crypto','research','tools'].includes(key) ? key : 'dashboard';
  });
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/kuartal-icon-mark.png" alt="Kuartal" />
        </div>
        <div className="brand-word">
          Kuartal <small>Terminal</small>
        </div>
        <CommandBar />
        <div className="spacer" />
        <Clock />
        <UserArea />
      </header>
      <Rail />
      <main className="main">
        <PageNav page={page} setPage={setPage} />
        {page === 'dashboard' ? <Tabs /> : <div className="page-spacer" />}
        {page === 'dashboard' ? <Workspace /> : <ResearchPage page={page} />}
      </main>
      <TickerTape />
      <Toast />
    </div>
  );
}

export { Toast, UserArea };
