import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_INSTRUMENTS } from '@shared/instruments';
import { askKuartal, parseCommand, type Reply } from '../lib/assistant';
import { runActions } from '../lib/actions';
import { PANELS, PANEL_ORDER, type PanelType } from '../lib/panels';
import { activeWorkspace, useStore } from '../lib/store';

type Item =
  | { kind: 'panel'; type: PanelType }
  | { kind: 'symbol'; symbol: string; label: string; name: string; group: string }
  | { kind: 'ask'; text: string };

export function CommandBar({ placeholder = 'Search markets, panels, or ask Kuartal…' }: { placeholder?: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<Reply | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  // Global shortcuts: "/" and Ctrl/Cmd+K focus the command bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const t = q.trim().toLowerCase();
    if (!t) return PANEL_ORDER.slice(0, 8).map((type) => ({ kind: 'panel', type }));
    const panels = PANEL_ORDER.filter((p) => p.toLowerCase().startsWith(t) || PANELS[p].title.toLowerCase().includes(t) || PANELS[p].keywords.some((k) => k.includes(t))).map<Item>((type) => ({ kind: 'panel', type }));
    const syms = ALL_INSTRUMENTS.filter((i) => i.label.toLowerCase().startsWith(t) || i.symbol.toLowerCase().startsWith(t) || i.name.toLowerCase().includes(t))
      .slice(0, 8)
      .map<Item>((i) => ({ kind: 'symbol', symbol: i.symbol, label: i.label, name: i.name, group: i.group }));
    const out: Item[] = [...syms, ...panels.slice(0, 6)];
    // Sentences go to Ask Kuartal first; short tokens prefer symbol/panel matches.
    if (t.includes(' ')) out.unshift({ kind: 'ask', text: q.trim() });
    else if (!out.length || t.length > 3) out.push({ kind: 'ask', text: q.trim() });
    return out;
  }, [q]);

  useEffect(() => setIdx(0), [q]);

  const finish = (reply: Reply) => {
    runActions(reply.actions);
    setAnswer(reply.actions.length ? null : reply);
    if (reply.actions.length) {
      setQ('');
      setOpen(false);
      input.current?.blur();
      useStore.getState().notify(reply.text);
    }
  };

  const choose = async (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'panel') return finish({ text: `Opened ${PANELS[item.type].title}.`, actions: [{ kind: 'open', type: item.type, reuse: true }] });
    if (item.kind === 'symbol') return finish({ text: `Charting ${item.label}.`, actions: [{ kind: 'focus', symbol: item.symbol }, { kind: 'open', type: 'CHT', params: { symbol: item.symbol }, reuse: true }] });
    const s = useStore.getState();
    finish(await askKuartal(item.text, { focusSymbol: s.focusSymbol, openPanels: activeWorkspace(s).panels.map((p) => p.type) }));
  };

  const onKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Exact mnemonic commands win over list selection (e.g. "BBCA SEA").
      const cmd = parseCommand(q);
      if (cmd && (q.trim().includes(' ') || idx === 0)) return finish(cmd);
      await choose(items[idx]);
    }
  };

  return (
    <div className="cmd" ref={wrap}>
      <div className="cmd-input">
        <span className="prompt" aria-hidden>
          &gt;
        </span>
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setAnswer(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Command bar"
          aria-expanded={open}
          aria-controls="cmd-menu"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="kbd">/</span>
      </div>
      {open && (
        <div className="cmd-menu" id="cmd-menu" role="listbox">
          {answer && (
            <div className="cmd-answer">
              {answer.text}
              {answer.suggestions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {answer.suggestions.map((s) => (
                    <button key={s} className="chip" onClick={() => choose({ kind: 'ask', text: s })}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!q && <div className="cmd-section">Panels</div>}
          {items.map((it, i) => (
            <button key={i} className={`cmd-item ${i === idx ? 'active' : ''}`} role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => choose(it)}>
              {it.kind === 'panel' && (
                <>
                  <span className="code">{it.type}</span>
                  <span className="label">
                    {PANELS[it.type].title} <span className="mute">— {PANELS[it.type].description}</span>
                  </span>
                  <span className="hint">{PANELS[it.type].pro ? 'PRO' : 'panel'}</span>
                </>
              )}
              {it.kind === 'symbol' && (
                <>
                  <span className="code">{it.label}</span>
                  <span className="label">
                    {it.name} <span className="mute">— {it.symbol}</span>
                  </span>
                  <span className="hint">{it.group}</span>
                </>
              )}
              {it.kind === 'ask' && (
                <>
                  <span className="code">ASK</span>
                  <span className="label">“{it.text}”</span>
                  <span className="hint">Ask Kuartal ↵</span>
                </>
              )}
            </button>
          ))}
          <div className="cmd-section" style={{ textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-sans)' }}>
            Try <b className="mono">BBCA</b>, <b className="mono">BTC BOOK</b>, <b className="mono">NWS rupiah</b>, or “show me bank stocks”.
          </div>
        </div>
      )}
    </div>
  );
}
