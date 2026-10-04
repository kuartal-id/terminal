import { useEffect, useMemo, useState } from 'react';
import type { Envelope, Quote } from '@shared/types';
import { MARKETS } from '@shared/instruments';
import { useApi } from '../lib/api';
import { dirClass, fmtPct, fmtPrice } from '../lib/format';
import { ErrorBox, Loading, SymbolButton } from '../components/bits';
import { useStore } from '../lib/store';
import type { PanelProps } from './types';

const GLOBAL_SYMBOLS = ['^GSPC','^IXIC','^FTSE','^GDAXI','^FCHI','^STOXX50E','^GSPTSE','^N225','^HSI','^KS11','^NSEI','000001.SS','^AXJO','^TASI.SR','^JKSE','^STI','^KLSE','^SET.BK','PSEI.PS','^VNINDEX'];
const ASEAN_COVERAGE = [
  ['Indonesia','^JKSE','Jakarta Composite','IDR'],['Malaysia','^KLSE','FTSE Bursa Malaysia KLCI','MYR'],['Singapore','^STI','Straits Times','SGD'],
  ['Thailand','^SET.BK','SET Index','THB'],['Philippines','PSEI.PS','PSE Composite','PHP'],['Vietnam','^VNINDEX','VN-Index','VND'],
  ['Brunei','—','No broad public benchmark wired yet','BND'],['Cambodia','—','No broad public benchmark wired yet','KHR'],['Laos','—','No broad public benchmark wired yet','LAK'],['Myanmar','—','No broad public benchmark wired yet','MMK'],
] as const;

const US_SYMBOLS = ['^GSPC', '^IXIC', '^DJI', '^RUT', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'JPM', 'BRK-B', 'XOM', 'UNH', 'AVGO', 'SPY', 'QQQ', 'IWM', 'EIDO'];
const BOND_SYMBOLS = ['^IRX', '^FVX', '^TNX', '^TYX', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'TIP', 'AGG'];
const FUND_CATEGORIES = [
  ['Reksa Dana Pasar Uang', 'Money-market funds focused on short-duration instruments and cash equivalents.'],
  ['Reksa Dana Obligasi', 'Bond funds investing primarily in debt securities.'],
  ['Reksa Dana Saham', 'Equity funds with portfolios primarily exposed to listed shares.'],
  ['Reksa Dana Campuran', 'Mixed-asset funds combining equity, fixed income and/or money-market instruments.'],
  ['Fixed Income', 'A broader research bucket for bonds, sukuk and income-oriented funds.'],
];

function QuoteTable({ symbols, title }: { symbols: string[]; title: string }) {
  const { data, error, reload } = useApi<Envelope<Quote[]>>(`/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}`, 30_000);
  const focus = useStore((s) => s.focus);
  useEffect(() => {
    if (data) {
      // Parent panels own the source badge; this child is deliberately presentation-only.
    }
  }, [data]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={8} />;
  const by = new Map(data.data.map((q) => [q.symbol, q]));
  return (
    <div>
      <div className="toolbar"><b>{title}</b><span className="mute" style={{ marginLeft: 'auto' }}>{data.source.toUpperCase()}</span></div>
      <table className="tbl">
        <thead><tr><th>Instrument</th><th className="num">Last</th><th className="num">Change</th><th className="num">%</th></tr></thead>
        <tbody>
          {symbols.map((symbol) => {
            const q = by.get(symbol);
            if (!q) return null;
            return (
              <tr key={symbol} className="click" onClick={() => focus(symbol)}>
                <td><span className="sym">{q.label}</span><span className="name"> {q.name}</span></td>
                <td className="num">{q.assetClass === 'rate' ? `${q.price.toFixed(3)}%` : fmtPrice(q.price, q.currency)}</td>
                <td className={`num ${dirClass(q.changePct)}`}>{q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2)}%</td>
                <td className="num"><span className={`chg-pill ${dirClass(q.changePct)}`}>{fmtPct(q.changePct)}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GlobalMarketsPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'delayed', provider: 'Yahoo Finance (unofficial chart API)' }), [report]);
  return <div><QuoteTable symbols={GLOBAL_SYMBOLS} title="Global Markets · US, Europe, Canada, Asia-Pacific, Middle East & ASEAN" /><div className="disclaimer" style={{ margin: 8 }}>Coverage is benchmark-first. Countries without a validated broad-market public feed are listed in the ASEAN coverage map rather than showing fabricated prices.</div><table className="tbl"><thead><tr><th>ASEAN market</th><th>Benchmark</th><th>Coverage</th><th>CCY</th></tr></thead><tbody>{ASEAN_COVERAGE.map(([country, symbol, benchmark, ccy]) => <tr key={country}><td className="sym">{country}</td><td>{symbol}</td><td>{benchmark}</td><td className="mono">{ccy}</td></tr>)}</tbody></table></div>;
}

export function UsMarketsPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'delayed', provider: 'Yahoo Finance (unofficial chart API)' }), [report]);
  return <QuoteTable symbols={US_SYMBOLS} title="US Markets · indices, mega-cap equities & ETFs" />;
}

export function BondsPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'eod', provider: 'U.S. Treasury + Yahoo Finance (unofficial ETF quotes)' }), [report]);
  return (
    <div>
      <QuoteTable symbols={BOND_SYMBOLS} title="Rates & Bonds · Treasury curve + bond ETFs" />
      <div className="disclaimer" style={{ margin: 8 }}>
        Treasury yields are sourced from the U.S. Treasury curve where available. ETF quotes are market-data observations and may be delayed.
      </div>
    </div>
  );
}

export function ScreenerPanel({ report }: PanelProps) {
  const [universe, setUniverse] = useState<'IDX' | 'US'>('IDX');
  const [minMove, setMinMove] = useState(-100);
  const symbols = useMemo(() => universe === 'IDX'
    ? MARKETS.filter((m) => m.group === 'Indonesia').map((m) => m.symbol).concat(['BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK','ASII.JK','ANTM.JK','AMRT.JK'])
    : US_SYMBOLS.filter((s) => !s.startsWith('^')),
  [universe]);
  const { data, error, reload } = useApi<Envelope<Quote[]>>(`/api/quotes?symbols=${encodeURIComponent([...new Set(symbols)].join(','))}`, 30_000);
  const focus = useStore((s) => s.focus);
  useEffect(() => report(data ? { source: data.source, provider: data.provider, asOf: data.asOf } : { source: 'delayed', provider: 'market quote service' }), [data, report]);
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={10} />;
  const rows = data.data.filter((q) => q.changePct >= minMove).sort((a, b) => b.changePct - a.changePct);
  return (
    <div>
      <div className="toolbar">
        <div className="seg"><button className={universe === 'IDX' ? 'on' : ''} onClick={() => setUniverse('IDX')}>IDX</button><button className={universe === 'US' ? 'on' : ''} onClick={() => setUniverse('US')}>USA</button></div>
        <label>Min daily % <input className="field mono" style={{ width: 72 }} type="number" step="0.5" value={minMove} onChange={(e) => setMinMove(Number(e.target.value))} /></label>
      </div>
      <table className="tbl">
        <thead><tr><th>Symbol</th><th>Name</th><th className="num">Last</th><th className="num">1D</th></tr></thead>
        <tbody>{rows.map((q) => <tr key={q.symbol} className="click" onClick={() => focus(q.symbol)}><td className="sym">{q.label}</td><td className="name">{q.name}</td><td className="num">{fmtPrice(q.price, q.currency)}</td><td className={`num ${dirClass(q.changePct)}`}>{fmtPct(q.changePct)}</td></tr>)}</tbody>
      </table>
      <div className="disclaimer">This is a quote-and-momentum screener using the free market feed. It does not rank securities as recommendations.</div>
    </div>
  );
}

export function SbnPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'static', provider: 'DJPPR Kementerian Keuangan RI' }), [report]);
  const open = () => window.open('https://djppr.kemenkeu.go.id/produkdanlayanan', '_blank', 'noopener,noreferrer');
  const rows = [
    ['SUN / FR', 'Fixed-rate government bonds', 'Benchmark and non-benchmark'],
    ['SPN / SPN-S', 'Short-term Treasury bills', 'Discount instruments'],
    ['PBS / SBSN', 'Government sukuk', 'Project-based / sharia securities'],
    ['SBN Ritel', 'Retail government securities', 'ORI, SBR, SR, ST and related programmes'],
  ];
  return (
    <div>
      <div className="toolbar"><b>Indonesia Government Bonds</b><span className="src static" style={{ marginLeft: 'auto' }}>OFFICIAL</span></div>
      <table className="tbl"><thead><tr><th>Family</th><th>Description</th><th>Research scope</th></tr></thead><tbody>{rows.map((r) => <tr key={r[0]}><td className="sym">{r[0]}</td><td>{r[1]}</td><td className="name">{r[2]}</td></tr>)}</tbody></table>
      <div className="panel-body pad">
        <p className="dim">Kuartal is reserving this page for benchmark yields, auction results, curve analytics and retail-SBN research. The current free-data build links directly to the official DJPPR source rather than inventing a secondary quote feed.</p>
        <button className="btn primary" onClick={open}>Open DJPPR SBN data</button>
      </div>
    </div>
  );
}

export function FundPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'static', provider: 'OJK public fund classifications' }), [report]);
  const open = () => window.open('https://ojk.go.id/id/kanal/pasar-modal/data-dan-statistik/Pages/Statistik-Pasar-Modal.aspx', '_blank', 'noopener,noreferrer');
  return (
    <div>
      <div className="toolbar"><b>Indonesia Funds & Fixed Income</b><span className="src static" style={{ marginLeft: 'auto' }}>OJK</span></div>
      {FUND_CATEGORIES.map(([name, desc]) => (
        <div key={name} className="list-row"><div><b>{name}</b><div className="dim">{desc}</div></div><span className="mono mute">RESEARCH</span></div>
      ))}
      <div className="panel-body pad">
        <p className="dim">Fund-level NAV, AUM, flows and performance require a dedicated public OJK/KSEI data adapter. Until that adapter is validated, Kuartal shows the official classification and research entry point rather than fabricated live fund numbers.</p>
        <button className="btn primary" onClick={open}>Open OJK fund statistics</button>
      </div>
    </div>
  );
}

export function AssetHubPanel({ report }: PanelProps) {
  useEffect(() => report({ source: 'static', provider: 'Kuartal asset catalogue' }), [report]);
  return (
    <div className="calc">
      <div className="calc-card"><h4>Equities</h4><p className="dim">IDX and US equity quotes, charts, watchlists and technical analytics.</p><SymbolButton symbol="^GSPC" label="S&P 500" /></div>
      <div className="calc-card"><h4>Bonds & Rates</h4><p className="dim">US Treasury curve, Treasury ETFs and the Indonesia SBN research hub.</p><SymbolButton symbol="^TNX" label="US 10Y Treasury" /></div>
      <div className="calc-card"><h4>Funds</h4><p className="dim">Money market, bond, equity, mixed and fixed-income research taxonomy, with OJK source handoff.</p></div>
      <div className="calc-card"><h4>Cross-Asset</h4><p className="dim">FX, commodities, crypto, macro, correlation and Kuartal Pulse remain available from the same dashboard.</p></div>
    </div>
  );
}
