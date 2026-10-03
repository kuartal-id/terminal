import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Envelope, History, Quote } from '@shared/types';
import { MARKETS, resolveInstrument } from '@shared/instruments';
import { ema, rsi, sma } from '@shared/math';
import { useApi } from '../lib/api';
import { dirClass, fmtChange, fmtCompact, fmtPct, fmtPrice } from '../lib/format';
import { useStore } from '../lib/store';
import { ErrorBox, Loading, Sparkline, SymbolButton } from '../components/bits';
import { I } from '../components/Icons';
import type { PanelProps } from './types';

// ───────────── OVR · Market Overview ─────────────

const GROUPS = ['Indonesia', 'Asia', 'US & Europe', 'FX', 'Commodities', 'Rates', 'Crypto'];

export function MarketOverview({ params, report }: PanelProps) {
  const groups = typeof params.groups === 'string' && params.groups ? params.groups.split(',') : GROUPS;
  const symbols = MARKETS.filter((m) => groups.includes(m.group)).map((m) => m.symbol);
  const { data, error, reload } = useApi<Envelope<Quote[]>>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 30_000);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf });
  }, [data, report]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={8} />;
  const bySym = new Map(data.data.map((q) => [q.symbol, q]));
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Market</th>
          <th className="num">Last</th>
          <th className="num">Chg</th>
          <th className="num">%</th>
          <th className="num">20D</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => (
          <GroupRows key={g} group={g} quotes={MARKETS.filter((m) => m.group === g).map((m) => bySym.get(m.symbol)).filter(Boolean) as Quote[]} />
        ))}
      </tbody>
    </table>
  );
}

function GroupRows({ group, quotes }: { group: string; quotes: Quote[] }) {
  const focus = useStore((s) => s.focus);
  if (!quotes.length) return null;
  return (
    <>
      <tr className="group">
        <td colSpan={5}>{group}</td>
      </tr>
      {quotes.map((q) => {
        const isRate = q.assetClass === 'rate';
        return (
          <tr key={q.symbol} className="click" onClick={() => focus(q.symbol)} title={`${q.name} — click to chart`}>
            <td>
              <span className="sym">{q.label}</span>
              {q.source === 'demo' && <span className="src demo" style={{ marginLeft: 6 }}>DEMO</span>}
            </td>
            <td className="num">{isRate ? `${q.price.toFixed(3)}%` : fmtPrice(q.price, q.currency)}</td>
            <td className={`num ${dirClass(q.change)}`}>{isRate ? `${(q.change * 100).toFixed(1)}bp` : fmtChange(q.change, q.currency, q.price)}</td>
            <td className="num">
              <span className={`chg-pill ${dirClass(q.changePct)}`}>{fmtPct(q.changePct)}</span>
            </td>
            <td className="num">
              <Sparkline values={q.spark} width={64} height={18} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ───────────── WL · Watchlist ─────────────

export function Watchlist({ report }: PanelProps) {
  const watchlist = useStore((s) => s.watchlist);
  const toggleWatch = useStore((s) => s.toggleWatch);
  const focus = useStore((s) => s.focus);
  const [adding, setAdding] = useState('');
  const resolved = watchlist.map((s) => resolveInstrument(s)?.symbol ?? s);
  const { data, error, reload } = useApi<Envelope<Quote[]>>(resolved.length ? `/api/quotes?symbols=${encodeURIComponent(resolved.join(','))}` : null, 30_000);
  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `${watchlist.length} symbols` });
  }, [data, report, watchlist.length]);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const inst = resolveInstrument(adding);
    if (inst && !watchlist.includes(inst.symbol) && !watchlist.includes(adding.toUpperCase())) toggleWatch(inst.symbol);
    setAdding('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <form className="toolbar" onSubmit={add}>
        <input className="field mono" style={{ flex: 1 }} value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add symbol: BBRI, gold, BTC…" aria-label="Add symbol" />
        <button className="btn small" type="submit">
          <I.plus width={12} height={12} /> Add
        </button>
      </form>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!watchlist.length && <div className="note">Your watchlist is empty. Add symbols above or press ☆ on any chart.</div>}
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {watchlist.length > 0 && !data && !error && <Loading rows={5} />}
        {data && (
          <table className="tbl">
            <tbody>
              {data.data.map((q) => (
                <tr key={q.symbol} className="click" onClick={() => focus(q.symbol)}>
                  <td>
                    <div className="sym">{q.label}</div>
                    <div className="name">{q.name}</div>
                  </td>
                  <td className="num">
                    <Sparkline values={q.spark} width={56} height={18} />
                  </td>
                  <td className="num">
                    <div>{q.assetClass === 'rate' ? `${q.price.toFixed(3)}%` : fmtPrice(q.price, q.currency)}</div>
                    <div className={dirClass(q.changePct)} style={{ fontSize: 11 }}>
                      {fmtPct(q.changePct)}
                    </div>
                  </td>
                  <td style={{ width: 24 }}>
                    <button
                      className="icon-btn"
                      style={{ width: 22, height: 22 }}
                      title="Remove"
                      aria-label={`Remove ${q.label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const key = watchlist.find((w) => (resolveInstrument(w)?.symbol ?? w) === q.symbol) ?? q.symbol;
                        toggleWatch(key);
                      }}
                    >
                      <I.close width={12} height={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ───────────── CHT · Chart ─────────────

const RANGES = ['1D', '5D', '1M', '6M', '1Y', '5Y', 'MAX'];

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

export function ChartPanel({ params, set, report }: PanelProps) {
  const symbolParam = String(params.symbol ?? '^JKSE');
  const inst = resolveInstrument(symbolParam)!;
  const range = String(params.range ?? '1Y');
  const indicator = String(params.ind ?? 'ma');
  const linked = params.linked !== false;
  const watchlist = useStore((s) => s.watchlist);
  const toggleWatch = useStore((s) => s.toggleWatch);
  const theme = useStore((s) => s.theme);
  const [input, setInput] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { data, error, reload } = useApi<Envelope<History>>(`/api/history?symbol=${encodeURIComponent(inst.symbol)}&range=${range}`, range === '1D' ? 60_000 : 300_000);

  useEffect(() => {
    if (data) report({ source: data.source, provider: data.provider, asOf: data.asOf, sub: `${inst.label} · ${range}` });
  }, [data, report, inst.label, range]);

  const last = data?.data.candles.at(-1);
  const first = data?.data.candles[0];
  const rangeChg = last && first ? ((last.close - first.open) / first.open) * 100 : undefined;
  const watched = watchlist.some((w) => (resolveInstrument(w)?.symbol ?? w) === inst.symbol);

  useEffect(() => {
    const el = box.current;
    if (!el || !data?.data.candles.length) return;
    const up = cssVar('--up');
    const down = cssVar('--down');
    const chart = createChart(el, {
      autoSize: true,
      localization: { locale: 'en-US' },
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: cssVar('--text-mute'), fontFamily: 'JetBrains Mono, monospace', fontSize: 10, attributionLogo: true },
      grid: { vertLines: { color: cssVar('--line-soft') }, horzLines: { color: cssVar('--line-soft') } },
      rightPriceScale: { borderColor: cssVar('--line') },
      timeScale: { borderColor: cssVar('--line'), timeVisible: range === '1D' || range === '5D' || range === '1M', secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chartRef.current = chart;
    const candles = data.data.candles.map((c) => ({ ...c, time: c.time as UTCTimestamp }));
    const cs = chart.addSeries(CandlestickSeries, { upColor: up, downColor: down, borderVisible: false, wickUpColor: up, wickDownColor: down });
    cs.setData(candles);
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', lastValueVisible: false, priceLineVisible: false });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: c.close >= c.open ? `${up}55` : `${down}55` })));
    const closes = candles.map((c) => c.close);
    if (indicator === 'ma') {
      const lines: [number, string, 'sma' | 'ema'][] = [[20, '#f5b942', 'ema'], [50, '#5cb8d6', 'sma'], [200, '#c38cf0', 'sma']];
      for (const [p, color, kind] of lines) {
        if (closes.length < p) continue;
        const vals = kind === 'ema' ? ema(closes, p) : sma(closes, p);
        const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, title: `${kind.toUpperCase()}${p}` });
        s.setData(candles.flatMap((c, i) => (vals[i] == null ? [] : [{ time: c.time, value: vals[i]! }])));
      }
    } else if (indicator === 'rsi') {
      const vals = rsi(closes, 14);
      const s = chart.addSeries(LineSeries, { color: '#f5b942', lineWidth: 1, priceLineVisible: false, title: 'RSI14' }, 1);
      s.setData(candles.flatMap((c, i) => (vals[i] == null ? [] : [{ time: c.time, value: vals[i]! }])));
      s.createPriceLine({ price: 70, color: down, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
      s.createPriceLine({ price: 30, color: up, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: '' });
      chart.panes()[1]?.setStretchFactor(0.35);
    }
    chart.timeScale().fitContent();
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [data, indicator, theme, range]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = resolveInstrument(input);
    if (r) set({ symbol: r.symbol });
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <form onSubmit={submit} style={{ display: 'flex', gap: 4 }}>
          <input className="field mono" style={{ width: 120 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder={inst.label} aria-label="Symbol" />
        </form>
        <div className="seg" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => set({ range: r })}>
              {r}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Indicator">
          <button className={indicator === 'ma' ? 'on' : ''} onClick={() => set({ ind: 'ma' })} title="EMA20 · SMA50 · SMA200">MA</button>
          <button className={indicator === 'rsi' ? 'on' : ''} onClick={() => set({ ind: 'rsi' })}>RSI</button>
          <button className={indicator === 'none' ? 'on' : ''} onClick={() => set({ ind: 'none' })}>—</button>
        </div>
        <button className={`icon-btn`} style={{ width: 26, height: 26, color: linked ? 'var(--accent)' : undefined }} title={linked ? 'Linked: follows symbols you click anywhere' : 'Unlinked'} onClick={() => set({ linked: !linked })} aria-pressed={linked}>
          <I.link width={14} height={14} />
        </button>
        <button className="icon-btn" style={{ width: 26, height: 26, color: watched ? 'var(--warn)' : undefined }} title={watched ? 'Remove from watchlist' : 'Add to watchlist'} onClick={() => toggleWatch(inst.symbol)} aria-pressed={watched}>
          {watched ? <I.starFill width={14} height={14} /> : <I.star width={14} height={14} />}
        </button>
        {last && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'baseline' }} className="mono">
            <b style={{ fontSize: 14 }}>{fmtPrice(last.close, data?.data.currency)}</b>
            <span className={dirClass(rangeChg)}>{fmtPct(rangeChg)} {range}</span>
            <span className="mute" style={{ fontSize: 11 }}>Vol {fmtCompact(last.volume)}</span>
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 120, position: 'relative' }}>
        {error && !data && <ErrorBox message={error.message} onRetry={reload} />}
        {!data && !error && <Loading rows={6} />}
        <div ref={box} style={{ position: 'absolute', inset: 0 }} />
      </div>
    </div>
  );
}

export function useQuoteMap(symbols: string[], refreshMs = 30_000) {
  const key = symbols.join(',');
  const res = useApi<Envelope<Quote[]>>(symbols.length ? `/api/quotes?symbols=${encodeURIComponent(key)}` : null, refreshMs);
  const map = useMemo(() => new Map((res.data?.data ?? []).map((q) => [q.symbol, q])), [res.data]);
  return { ...res, map };
}

export { SymbolButton };
