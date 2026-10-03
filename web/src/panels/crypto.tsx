import { useEffect, useMemo, useRef, useState } from 'react';
import { MARKETS } from '@shared/instruments';
import { useDepth, useMiniTickers } from '../lib/binance';
import { dirClass, fmtCompact, fmtPct, fmtPrice } from '../lib/format';
import { useStore } from '../lib/store';
import { Loading } from '../components/bits';
import { useQuoteMap } from './markets';
import type { PanelProps } from './types';

const DEFAULT_CRYPTO = [...MARKETS.filter((m) => m.assetClass === 'crypto').map((m) => m.symbol), 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'TONUSDT'];

// ───────────── CRY · Crypto Live ─────────────

export function CryptoLive({ report }: PanelProps) {
  const symbols = DEFAULT_CRYPTO;
  const { tickers, connected } = useMiniTickers(symbols);
  // REST fallback (also seeds the table before the socket's first message).
  const rest = useQuoteMap(symbols, connected ? 0 : 15_000);
  const focus = useStore((s) => s.focus);
  const prev = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, 'up' | 'down'>>({});

  useEffect(() => {
    report({ source: connected ? 'live' : rest.data?.source, provider: connected ? 'Binance websocket' : rest.data?.provider ?? 'Binance', asOf: new Date().toISOString() });
  }, [connected, rest.data, report]);

  useEffect(() => {
    const f: Record<string, 'up' | 'down'> = {};
    for (const [s, t] of Object.entries(tickers)) {
      const p = prev.current[s];
      if (p != null && t.price !== p) f[s] = t.price > p ? 'up' : 'down';
      prev.current[s] = t.price;
    }
    if (Object.keys(f).length) {
      setFlash(f);
      const id = setTimeout(() => setFlash({}), 600);
      return () => clearTimeout(id);
    }
  }, [tickers]);

  const rows = symbols.map((s) => {
    const t = tickers[s];
    const q = rest.map.get(s);
    return { s, label: s.replace(/USDT$/, ''), price: t?.price ?? q?.price, pct: t?.changePct ?? q?.changePct, vol: t?.quoteVolume ?? q?.volume, high: t?.high ?? q?.dayHigh, low: t?.low ?? q?.dayLow };
  });
  if (!rows.some((r) => r.price != null)) return <Loading rows={6} />;
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Pair</th>
          <th className="num">Last (USDT)</th>
          <th className="num">24h %</th>
          <th className="num">24h Vol</th>
          <th className="num">Range</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.s} className="click" onClick={() => focus(r.s)}>
            <td>
              <span className="sym">{r.label}</span>
            </td>
            <td className="num" style={{ transition: 'background .4s', background: flash[r.s] ? `var(--${flash[r.s]}-soft)` : undefined }}>
              {fmtPrice(r.price)}
            </td>
            <td className={`num ${dirClass(r.pct)}`}>{fmtPct(r.pct)}</td>
            <td className="num">{fmtCompact(r.vol)}</td>
            <td className="num">
              <RangeBar low={r.low} high={r.high} last={r.price} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RangeBar({ low, high, last }: { low?: number; high?: number; last?: number }) {
  if (low == null || high == null || last == null || high <= low) return <span className="mute">—</span>;
  const pos = ((last - low) / (high - low)) * 100;
  return (
    <span style={{ display: 'inline-block', width: 60, height: 6, background: 'var(--line-soft)', borderRadius: 3, position: 'relative', verticalAlign: 'middle' }} title={`Low ${fmtPrice(low)} · High ${fmtPrice(high)}`}>
      <span style={{ position: 'absolute', left: `calc(${pos}% - 2px)`, top: -2, width: 4, height: 10, borderRadius: 2, background: 'var(--accent)' }} />
    </span>
  );
}

// ───────────── BOOK · Order Book ─────────────

const BOOK_PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'PAXGUSDT'];

export function OrderBook({ params, set, report }: PanelProps) {
  const raw = String(params.symbol ?? 'BTCUSDT').toUpperCase();
  const symbol = /USDT$/.test(raw) ? raw : 'BTCUSDT';
  const { depth, connected } = useDepth(symbol, 20);
  useEffect(() => {
    report({ source: connected ? 'live' : undefined, provider: 'Binance websocket (depth20 @500ms)', asOf: new Date().toISOString(), sub: symbol.replace('USDT', '/USDT') });
  }, [connected, report, symbol]);

  const view = useMemo(() => {
    if (!depth) return undefined;
    const asks = [...depth.asks].sort((a, b) => a[0] - b[0]).slice(0, 14);
    const bids = [...depth.bids].sort((a, b) => b[0] - a[0]).slice(0, 14);
    let ca = 0;
    const askCum = asks.map(([p, q]) => [p, q, (ca += q)] as const);
    let cb = 0;
    const bidCum = bids.map(([p, q]) => [p, q, (cb += q)] as const);
    const max = Math.max(ca, cb);
    const bestAsk = asks[0]?.[0];
    const bestBid = bids[0]?.[0];
    const imbalance = ca + cb ? ((cb - ca) / (ca + cb)) * 100 : 0;
    return { askCum: askCum.reverse(), bidCum, max, mid: bestAsk && bestBid ? (bestAsk + bestBid) / 2 : undefined, spread: bestAsk && bestBid ? bestAsk - bestBid : undefined, imbalance };
  }, [depth]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <select className="field" value={symbol} onChange={(e) => set({ symbol: e.target.value })} aria-label="Pair">
          {[...new Set([symbol, ...BOOK_PAIRS])].map((p) => (
            <option key={p} value={p}>
              {p.replace('USDT', '/USDT')}
            </option>
          ))}
        </select>
        {view && (
          <span className="mono" style={{ fontSize: 11, marginLeft: 'auto' }} title="Bid volume minus ask volume across the visible book">
            Imb <b className={dirClass(view.imbalance)}>{fmtPct(view.imbalance, 1)}</b>
          </span>
        )}
      </div>
      {!view ? (
        <div className="note">{connected ? 'Waiting for book…' : 'Connecting to Binance… (if this never connects, your network may block the Binance websocket)'}</div>
      ) : (
        <div className="book" style={{ flex: 1, overflow: 'auto' }}>
          <div className="book-row mute" style={{ fontSize: 10 }}>
            <span>PRICE</span>
            <span>SIZE</span>
            <span>CUM</span>
          </div>
          {view.askCum.map(([p, q, c]) => (
            <div className="book-row" key={`a${p}`}>
              <span className="down">{fmtPrice(p)}</span>
              <span>{q.toFixed(4)}</span>
              <span className="mute">{c.toFixed(3)}</span>
              <i className="depth" style={{ width: `${(c / view.max) * 100}%`, background: 'var(--down-soft)' }} />
            </div>
          ))}
          <div className="book-mid">
            <span>{fmtPrice(view.mid)}</span>
            <span className="mute" style={{ fontWeight: 400 }}>spread {fmtPrice(view.spread)}</span>
          </div>
          {view.bidCum.map(([p, q, c]) => (
            <div className="book-row" key={`b${p}`}>
              <span className="up">{fmtPrice(p)}</span>
              <span>{q.toFixed(4)}</span>
              <span className="mute">{c.toFixed(3)}</span>
              <i className="depth" style={{ width: `${(c / view.max) * 100}%`, background: 'var(--up-soft)' }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
