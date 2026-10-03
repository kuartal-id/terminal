import { useEffect, useRef, useState } from 'react';
import { askKuartal, type Reply } from '../lib/assistant';
import { runActions } from '../lib/actions';
import { fmtNum } from '../lib/format';
import { CATEGORIES, PANELS, PANEL_ORDER } from '../lib/panels';
import { activeWorkspace, useStore } from '../lib/store';
import type { PanelProps } from './types';

// ───────────── CAL · Calculators ─────────────

/** IDX price fractions (tick sizes) by price band. */
export function idxTick(price: number): number {
  if (price < 200) return 1;
  if (price < 500) return 2;
  if (price < 2000) return 5;
  if (price < 5000) return 10;
  return 25;
}

function NumField({ label, value, onChange, step = 'any' }: { label: string; value: number; onChange: (v: number) => void; step?: string }) {
  return (
    <label>
      {label}
      <input className="field mono" type="number" step={step} value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Calculators({ report }: PanelProps) {
  useEffect(() => report({ source: 'static', provider: 'Runs in your browser' }), [report]);
  // IDX trade cost
  const [price, setPrice] = useState(6325);
  const [lots, setLots] = useState(10);
  const [buyFee, setBuyFee] = useState(0.15);
  const [sellFee, setSellFee] = useState(0.25);
  const [exitPrice, setExitPrice] = useState(6600);
  const shares = lots * 100;
  const buyValue = shares * price;
  const buyCost = buyValue * (1 + buyFee / 100);
  const sellProceeds = shares * exitPrice * (1 - sellFee / 100);
  const pnl = sellProceeds - buyCost;
  const breakeven = buyCost / (shares * (1 - sellFee / 100));
  const tick = idxTick(breakeven);
  const breakevenTick = Math.ceil(breakeven / tick) * tick;

  // Position size
  const [equity, setEquity] = useState(100_000_000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(3270);
  const [stop, setStop] = useState(3100);
  const riskAmt = equity * (riskPct / 100);
  const perShare = Math.abs(entry - stop);
  const posShares = perShare > 0 ? Math.floor(riskAmt / perShare / 100) * 100 : 0;

  // Compounding / DCA
  const [start, setStart] = useState(10_000_000);
  const [monthly, setMonthly] = useState(1_000_000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(10);
  const r = rate / 100 / 12;
  const n = years * 12;
  const fv = r === 0 ? start + monthly * n : start * (1 + r) ** n + monthly * (((1 + r) ** n - 1) / r);
  const contributed = start + monthly * n;

  return (
    <div className="calc">
      <div className="calc-card">
        <h4>IDX trade cost &amp; break-even</h4>
        <NumField label="Buy price (Rp)" value={price} onChange={setPrice} />
        <NumField label="Lots (×100 shares)" value={lots} onChange={setLots} step="1" />
        <NumField label="Buy fee %" value={buyFee} onChange={setBuyFee} />
        <NumField label="Sell fee % (incl. tax)" value={sellFee} onChange={setSellFee} />
        <NumField label="Exit price (Rp)" value={exitPrice} onChange={setExitPrice} />
        <div className="out">
          <span>Cost: Rp {fmtNum(buyCost, 0)}</span>
          <span>Proceeds: Rp {fmtNum(sellProceeds, 0)}</span>
          <span className={pnl >= 0 ? 'up' : 'down'}>P/L: Rp {fmtNum(pnl, 0)} ({fmtNum((pnl / buyCost) * 100, 2)}%)</span>
          <span>Break-even: Rp {fmtNum(breakevenTick, 0)} <span className="mute">(tick {tick})</span></span>
        </div>
      </div>
      <div className="calc-card">
        <h4>Position size from risk</h4>
        <NumField label="Account (Rp)" value={equity} onChange={setEquity} />
        <NumField label="Risk per trade %" value={riskPct} onChange={setRiskPct} />
        <NumField label="Entry (Rp)" value={entry} onChange={setEntry} />
        <NumField label="Stop (Rp)" value={stop} onChange={setStop} />
        <div className="out">
          <span>Max loss: Rp {fmtNum(riskAmt, 0)}</span>
          <span>Size: {fmtNum(posShares / 100, 0)} lots ({fmtNum(posShares, 0)} sh)</span>
          <span>Position value: Rp {fmtNum(posShares * entry, 0)}</span>
          <span className="mute">{fmtNum(((posShares * entry) / equity) * 100, 1)}% of account</span>
        </div>
      </div>
      <div className="calc-card">
        <h4>Compounding &amp; monthly investing</h4>
        <NumField label="Starting amount" value={start} onChange={setStart} />
        <NumField label="Monthly addition" value={monthly} onChange={setMonthly} />
        <NumField label="Annual return %" value={rate} onChange={setRate} />
        <NumField label="Years" value={years} onChange={setYears} step="1" />
        <div className="out">
          <span>Future value: {fmtNum(fv, 0)}</span>
          <span>You put in: {fmtNum(contributed, 0)}</span>
          <span className="up">Growth: {fmtNum(fv - contributed, 0)}</span>
        </div>
      </div>
      <div className="disclaimer" style={{ gridColumn: '1 / -1' }}>
        Fee defaults are typical retail broker rates (sell side includes 0.1% final sales tax) — check your broker. IDX tick sizes: &lt;Rp200 →1, &lt;500 →2, &lt;2,000 →5, &lt;5,000 →10, ≥5,000 →25.
      </div>
    </div>
  );
}

// ───────────── ASK · Ask Kuartal ─────────────

interface Msg {
  who: 'user' | 'bot';
  text: string;
  suggestions?: string[];
}

export function AskPanel({ report }: PanelProps) {
  const [log, setLog] = useState<Msg[]>([
    {
      who: 'bot',
      text: 'Ask Kuartal is coming soon. The research terminal is ready today; the full self-hosted AI assistant will arrive in a later release.',
      suggestions: ['Show US markets', 'Open Indonesia SBN', 'Show bonds and Treasuries', 'Show reksa dana research'],
    },
  ]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => report({ provider: 'Ask Kuartal · Coming soon', source: 'static' }), [report]);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [log]);

  const send = async (q: string) => {
    if (!q.trim() || busy) return;
    setLog((l) => [...l, { who: 'user', text: q }]);
    setText('');
    setBusy(true);
    const s = useStore.getState();
    const reply: Reply = await askKuartal(q, { focusSymbol: s.focusSymbol, openPanels: activeWorkspace(s).panels.map((p) => p.type) });
    runActions(reply.actions);
    setLog((l) => [...l, { who: 'bot', text: reply.text, suggestions: reply.suggestions }]);
    setBusy(false);
  };

  return (
    <div className="ask">
      <div className="ask-log" aria-live="polite">
        {log.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            {m.text}
            {m.suggestions && (
              <div className="acts">
                {m.suggestions.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <input className="field" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask Kuartal… e.g. chart BBRI with RSI" aria-label="Ask Kuartal" />
        <button className="btn primary small" type="submit" disabled={busy}>
          Ask
        </button>
      </form>
    </div>
  );
}

// ───────────── HELP · Terminal Guide ─────────────

export function GuidePanel({ report }: PanelProps) {
  const openPanel = useStore((s) => s.openPanel);
  useEffect(() => report({ source: 'static', provider: 'Kuartal Terminal' }), [report]);
  return (
    <div style={{ padding: 10, lineHeight: 1.55 }}>
      <p className="section-label">Command bar</p>
      <p style={{ marginTop: 0 }}>
        Press <span className="kbd">/</span> or <span className="kbd">Ctrl K</span> anywhere. Type a symbol, a panel code, or a plain sentence.
      </p>
      <table className="tbl mono" style={{ fontSize: 11.5 }}>
        <tbody>
          {[
            ['BBCA', 'Chart BBCA (IDX codes work without .JK)'],
            ['BBRI GP', 'Chart (GP = graph price)'],
            ['GOLD SEA', 'Seasonality of gold (Pro)'],
            ['BTC BOOK', 'Live order book'],
            ['NWS rupiah', 'Search news'],
            ['WATCH TLKM', 'Add/remove from watchlist'],
            ['WS INDONESIA', 'Open a preset workspace'],
            ['THEME LIGHT', 'Switch theme'],
            ['show me bank stocks', 'Ask Kuartal in plain language'],
          ].map(([c, d]) => (
            <tr key={c}>
              <td style={{ color: 'var(--accent)' }}>{c}</td>
              <td style={{ fontFamily: 'var(--font-sans)', whiteSpace: 'normal' }}>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="section-label" style={{ marginTop: 14 }}>Panels</p>
      {CATEGORIES.map((c) => (
        <div key={c} style={{ marginBottom: 8 }}>
          <div className="mute" style={{ fontSize: 11 }}>{c}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>
            {PANEL_ORDER.filter((t) => PANELS[t].category === c).map((t) => (
              <button key={t} className="chip" onClick={() => openPanel(t, {}, { reuse: true })} title={PANELS[t].description}>
                <b className="mono" style={{ color: 'var(--accent)' }}>{t}</b> {PANELS[t].title}
                {PANELS[t].pro ? ' · PRO' : ''}
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="section-label" style={{ marginTop: 14 }}>Data labels</p>
      <p style={{ marginTop: 0 }}>
        Every panel shows where its data comes from: <span className="src live">LIVE</span> real-time, <span className="src delayed">DELAYED</span> exchange data (~15 min), <span className="src eod">EOD</span> daily reference, <span className="src static">ANNUAL</span> official statistics, and <span className="src demo">DEMO</span> when a source was unreachable and illustrative numbers are shown instead.
      </p>
      <p className="section-label" style={{ marginTop: 14 }}>Workspaces</p>
      <p style={{ marginTop: 0 }}>Drag panels by their header, resize from the corner. Layouts save automatically in this browser. Click any symbol to send it to linked (🔗) charts.</p>
      <p className="mute" style={{ fontSize: 11 }}>
        Kuartal Terminal is a free research tool from PT Kuartal Financial Group. Nothing here is investment advice. Data comes from public sources and may be delayed or incomplete.
      </p>
    </div>
  );
}
