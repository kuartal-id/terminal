import { useEffect, useMemo, useState } from 'react';
import type { Envelope, Quote } from '@shared/types';
import { useApi } from '../lib/api';
import { dirClass, fmtPct, fmtPrice } from '../lib/format';
import { ErrorBox, Loading } from '../components/bits';
import type { PanelProps } from './types';
import { useStore } from '../lib/store';

type ResearchSpec = {
  title: string;
  subtitle: string;
  symbols?: string[];
  note?: string;
  source?: string;
};

function ResearchTable({ spec, report }: { spec: ResearchSpec; report: PanelProps['report'] }) {
  const symbols = spec.symbols ?? [];
  const { data, error, reload } = useApi<Envelope<Quote[]>>(
    symbols.length ? `/api/quotes?symbols=${encodeURIComponent(symbols.join(','))}` : '',
    60_000,
  );
  const focus = useStore((s) => s.focus);
  useEffect(() => {
    report(data ? { source: data.source, provider: data.provider, asOf: data.asOf, sub: spec.title } : { source: 'static', provider: spec.source ?? 'Kuartal research model' });
  }, [data, report, spec.source, spec.title]);
  if (!symbols.length) {
    return (
      <div className="panel-body pad">
        <div className="section-label">{spec.title}</div>
        <h3 style={{ marginTop: 4 }}>{spec.subtitle}</h3>
        <p className="dim">{spec.note}</p>
        <div className="disclaimer">This workspace is wired into the terminal catalogue but does not fabricate unavailable institutional data.</div>
      </div>
    );
  }
  if (error && !data) return <ErrorBox message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={6} />;
  const rows = [...data.data].sort((a, b) => b.changePct - a.changePct);
  return (
    <div>
      <div className="panel-body pad">
        <div className="section-label">{spec.title}</div>
        <h3 style={{ margin: '4px 0' }}>{spec.subtitle}</h3>
        <p className="dim">{spec.note}</p>
      </div>
      <table className="tbl">
        <thead><tr><th>Instrument</th><th className="num">Last</th><th className="num">1D</th><th className="num">Signal</th></tr></thead>
        <tbody>{rows.map((q) => (
          <tr key={q.symbol} className="click" onClick={() => focus(q.symbol)}>
            <td><span className="sym">{q.label}</span> <span className="name">{q.name}</span></td>
            <td className="num">{q.assetClass === 'rate' ? `${q.price.toFixed(3)}%` : fmtPrice(q.price, q.currency)}</td>
            <td className={`num ${dirClass(q.changePct)}`}>{fmtPct(q.changePct)}</td>
            <td className="num"><span className={`chg-pill ${dirClass(q.changePct)}`}>{q.changePct > 1 ? 'RISK-ON' : q.changePct < -1 ? 'RISK-OFF' : 'NEUTRAL'}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function staticPanel(spec: ResearchSpec) {
  return function StaticResearchPanel({ report }: PanelProps) {
    return <ResearchTable spec={spec} report={report} />;
  };
}

function quotePanel(spec: ResearchSpec) {
  return function QuoteResearchPanel({ report }: PanelProps) {
    return <ResearchTable spec={spec} report={report} />;
  };
}

export const CompanyFundamentalsPanel = staticPanel({
  title: 'Company Fundamentals',
  subtitle: 'Fundamental research workspace for USA and IDX equities.',
  symbols: ['AAPL','MSFT','NVDA','AMZN','META','BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK'],
  note: 'Price and identity are live where supported. Revenue, margins, valuation, earnings and balance-sheet fields are reserved for a validated fundamentals adapter rather than estimated values.',
  source: 'Fundamentals adapter roadmap',
});

export const EquityFactorPanel = quotePanel({
  title: 'Equity Factor Scoring',
  subtitle: 'Transparent first-pass factor ranking across USA and IDX.',
  symbols: ['AAPL','MSFT','NVDA','AMZN','META','JPM','XOM','BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK','ASII.JK'],
  note: 'Current score layer uses observable price momentum only. Quality, value, size and profitability factors will be added when fundamentals coverage is validated.',
});

export const EquityPricesPanel = quotePanel({
  title: 'Equity Prices',
  subtitle: 'Cross-market equity price matrix for major USA and IDX names.',
  symbols: ['AAPL','MSFT','NVDA','AMZN','META','JPM','XOM','BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK','ASII.JK','ANTM.JK'],
});

export const IdxAuctionFlowPanel = staticPanel({
  title: 'IDX Auction Flow',
  subtitle: 'Closing-auction research workspace.',
  note: 'Auction imbalance, closing-volume concentration and participant-flow data require a licensed or official auction-feed adapter. The interface is reserved and clearly marked until such data is available.',
  source: 'IDX auction-feed adapter roadmap',
});

export const IdxForeignFlowPanel = staticPanel({
  title: 'IDX Foreign Flow Screener',
  subtitle: 'Foreign net-buy and net-sell research for IDX.',
  note: 'Foreign flow requires validated participant-level or exchange-provided data. No foreign-flow numbers are inferred from price or volume.',
  source: 'IDX foreign-flow adapter roadmap',
});

export const IdxOwnershipPanel = staticPanel({
  title: 'IDX Ownership Data',
  subtitle: 'Ownership structure, investor profiles and monthly changes.',
  note: 'Shareholder networks and beneficial ownership are reserved for validated KSEI/OJK/IDX sources. The terminal will not infer ownership from public price data.',
  source: 'OJK/KSEI ownership adapter roadmap',
});

export const IdxStockScannerPanel = quotePanel({
  title: 'IDX Stock Scanner',
  subtitle: 'IDX radar with momentum, liquidity and price-change views.',
  symbols: ['BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK','ASII.JK','ANTM.JK','AMRT.JK','GOTO.JK','UNTR.JK','ICBP.JK'],
});

export const InstitutionalPortfoliosPanel = staticPanel({
  title: 'Institutional Portfolios',
  subtitle: '13F-style institutional portfolio research.',
  note: '13F holdings are regulatory filings, not real-time positions. A filing ingestion layer will be added before portfolio values or changes are displayed.',
  source: 'SEC filing adapter roadmap',
});

export const InvestorPortfoliosPanel = staticPanel({
  title: 'Investor Portfolios',
  subtitle: 'Notable investor and portfolio-manager research.',
  note: 'Investor attribution will use primary filings and disclosed vehicles. The terminal will not manufacture investor holdings from news articles.',
  source: 'Regulatory filing research',
});

export const MarketBreadthPanel = quotePanel({
  title: 'Market Breadth & Internals',
  subtitle: 'Breadth monitor showing participation behind major equity moves.',
  symbols: ['^GSPC','^IXIC','^DJI','^RUT','AAPL','MSFT','NVDA','AMZN','META','JPM','XOM','UNH','V','MA','COST','WMT'],
});

export const StockScreenerPanel = quotePanel({
  title: 'Stock Screener',
  subtitle: 'Combined USA and IDX quote-and-momentum screening universe.',
  symbols: ['AAPL','MSFT','NVDA','AMZN','META','JPM','XOM','BBCA.JK','BBRI.JK','BMRI.JK','TLKM.JK','ASII.JK','ANTM.JK'],
});

export const SectorRotationPanel = quotePanel({
  title: 'Theme & Sector Rotation',
  subtitle: 'Relative rotation monitor using liquid sector ETFs as transparent proxies.',
  symbols: ['XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLB','XLRE','XLC'],
  note: 'ETF price momentum is used as a proxy for sector rotation. Full industry/theme taxonomy is a later research layer.',
});

export const EtfDetailPanel = quotePanel({
  title: 'ETF Detail Analysis',
  subtitle: 'Per-ticker ETF research workspace.',
  symbols: ['SPY','QQQ','IWM','DIA','TLT','IEF','SHY','LQD','HYG','TIP','AGG'],
  note: 'Market price is live/delayed where supported. Holdings, AUM, expense ratio and creation/redemption data require dedicated ETF metadata.',
});

export const EtfFlowsPanel = staticPanel({
  title: 'ETF Flows',
  subtitle: 'Fund-flow research by ETF.',
  note: 'Daily creations/redemptions and net flows require a validated fund-flow data source. The workspace is intentionally empty rather than deriving flows from price.',
  source: 'ETF flow adapter roadmap',
});

export const EtfPricesPanel = quotePanel({
  title: 'ETF Prices',
  subtitle: 'ETF price matrix with daily performance and trend context.',
  symbols: ['SPY','QQQ','IWM','DIA','TLT','IEF','SHY','LQD','HYG','TIP','AGG','GLD','SLV','USO'],
});

export const EtfScreenerPanel = quotePanel({
  title: 'ETF Screener',
  subtitle: 'ETF universe organized around asset class, geography, momentum and income proxies.',
  symbols: ['SPY','QQQ','IWM','DIA','TLT','IEF','SHY','LQD','HYG','TIP','AGG','GLD','SLV','USO'],
});

export const DollarFundingStressPanel = staticPanel({
  title: 'Dollar Funding Stress',
  subtitle: 'Funding-stress research combining dollar liquidity proxies.',
  note: 'A composite score will require validated SOFR/OIS, cross-currency basis and central-bank facility data. No synthetic stress score is presented as market fact.',
  source: 'Rates and funding adapter roadmap',
});

export const FxCarryPanel = staticPanel({
  title: 'FX Carry & Valuation',
  subtitle: 'Relative carry and valuation workspace for major currencies.',
  note: 'The current FX service provides reference rates. Forward points, policy-rate differentials and valuation anchors will be added as validated adapters become available.',
  source: 'FX reference-rate service',
});

export const FxStrengthPanel = staticPanel({
  title: 'FX Strength & Momentum',
  subtitle: 'Relative currency strength and rotation monitor.',
  note: 'The existing FX Board provides reference-rate momentum. A dedicated multi-factor strength model will follow with transparent methodology.',
  source: 'ECB/Frankfurter reference rates',
});

export const ForexPricesPanel = staticPanel({
  title: 'Forex Prices',
  subtitle: 'Major, minor and emerging-currency reference matrix.',
  note: 'The free build uses daily ECB/Frankfurter reference rates, not broker executable quotes.',
  source: 'ECB/Frankfurter reference rates',
});

export const FixedIncomePricesPanel = quotePanel({
  title: 'Fixed Income Prices',
  subtitle: 'Government-rate and fixed-income ETF market monitor.',
  symbols: ['^IRX','^FVX','^TNX','^TYX','TLT','IEF','SHY','LQD','HYG','TIP','AGG'],
});

export const GlobalYieldCurvePanel = quotePanel({
  title: 'Global Yield Curve',
  subtitle: 'Sovereign benchmark-rate comparison across major economies.',
  symbols: ['^TNX','^TYX','^GSPTSE','^N225','^HSI','^KS11','^NSEI','^FTSE','^GDAXI','^FCHI'],
  note: 'Index symbols are included for cross-asset context; sovereign yields are only displayed when the upstream identifies them as rates. Dedicated country curves are a later data-adapter layer.',
});

export const UsRatePricingPanel = staticPanel({
  title: 'US Rate Pricing',
  subtitle: 'Market-implied Federal Reserve path research.',
  note: 'Meeting probabilities and forward policy pricing require Fed Funds futures/OIS data. The interface is reserved until a validated rate-pricing source is connected.',
  source: 'US rates pricing adapter roadmap',
});

export const UsRealYieldsPanel = staticPanel({
  title: 'US Real Yields',
  subtitle: 'Real-yield level and momentum monitor.',
  note: 'TIPS real-yield series will be connected to official Treasury/FRED data. Nominal yields are not mislabeled as real yields.',
  source: 'Treasury/FRED adapter roadmap',
});

export const CreditDefaultSwapPanel = staticPanel({
  title: 'Credit Default Swap',
  subtitle: 'Sovereign CDS risk monitor.',
  note: 'CDS spreads, implied default probabilities and ratings require licensed credit-market data. No synthetic CDS prices are shown.',
  source: 'Credit-market adapter roadmap',
});

export const CreditSentimentPanel = staticPanel({
  title: 'Credit Market Sentiment',
  subtitle: 'HY/IG spread and risk-premium workspace.',
  note: 'OAS, percentile and z-score analytics will be connected to a validated credit index source before publication.',
  source: 'Credit-index adapter roadmap',
});

export const CreditRatingsPanel = staticPanel({
  title: 'Credit Ratings',
  subtitle: 'Sovereign ratings comparison across major agencies.',
  note: 'Ratings will be sourced from agency disclosures. The current workspace avoids reproducing stale ratings without a refreshable source.',
  source: 'Agency disclosure adapter roadmap',
});

export const AgricultureWeatherPanel = staticPanel({
  title: 'Agriculture Weather',
  subtitle: 'Weather context for major agricultural production regions.',
  note: 'Production-region weather will use public meteorological data. The terminal will separate observed weather from modeled crop-impact signals.',
  source: 'Meteorological adapter roadmap',
});

export const CommodityPricesPanel = quotePanel({
  title: 'Commodity Prices',
  subtitle: 'Energy, metals and agricultural futures monitor.',
  symbols: ['GC=F','SI=F','CL=F','BZ=F','NG=F','HG=F','ZC=F','ZS=F','ZW=F','SB=F','KC=F','CC=F'],
});

export const CrudeOilFundamentalPanel = staticPanel({
  title: 'Crude Oil Fundamental',
  subtitle: 'Physical balance, macro and curve research for crude oil.',
  note: 'Inventory, OPEC supply, refinery runs, freight and curve data will be combined only from validated sources. Price alone is not treated as a physical balance.',
  source: 'Energy fundamentals adapter roadmap',
});

export const GoldFundamentalPanel = staticPanel({
  title: 'Gold Fundamental',
  subtitle: 'Gold supply, demand, reserves and ETF research.',
  note: 'Official reserve data, ETF holdings and demand/supply series require dedicated World Gold Council and official-source adapters.',
  source: 'Gold fundamentals adapter roadmap',
});

export const GoldIntermarketPanel = quotePanel({
  title: 'Gold Intermarket Signal',
  subtitle: 'Gold regime monitor using gold, rates, dollar and risk proxies.',
  symbols: ['GC=F','^TNX','DX-Y.NYB','^GSPC','BTCUSDT'],
  note: 'The signal is a transparent cross-asset context table, not a prediction or investment recommendation.',
});

export const CryptoScannerPanel = quotePanel({
  title: 'Crypto Live Scanner',
  subtitle: 'Live crypto momentum and market-activity monitor.',
  symbols: ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT'],
});

export const CryptoNarrativesPanel = staticPanel({
  title: 'Crypto Narratives & Trends',
  subtitle: 'Narrative research for leading and rotating digital-asset themes.',
  note: 'Narrative tagging will be driven by news and market taxonomy. No narrative leadership score is fabricated from price alone.',
  source: 'Crypto research engine roadmap',
});

export const CryptoWhalePanel = staticPanel({
  title: 'Crypto Whale Tracker',
  subtitle: 'Large-position and liquidation-risk research.',
  note: 'Wallet and perpetual-position analytics require exchange and on-chain data. This workspace will not infer whale activity from ordinary volume.',
  source: 'On-chain and derivatives adapter roadmap',
});

export const CryptoPricesPanel = quotePanel({
  title: 'Cryptocurrency Prices',
  subtitle: 'Major crypto assets and liquid pairs.',
  symbols: ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT'],
});

export const LiquidationMapPanel = staticPanel({
  title: 'Liquidation Map',
  subtitle: 'Potential forced-liquidation concentration monitor.',
  note: 'Liquidation heatmaps require exchange-level open-interest and liquidation feeds. The UI is ready without inventing liquidation levels.',
  source: 'Crypto derivatives adapter roadmap',
});

export const FuturesTermStructurePanel = staticPanel({
  title: 'Futures Term Structure',
  subtitle: 'Contango/backwardation research across futures curves.',
  note: 'Full term structures require multi-expiry futures data. Current commodity quotes are spot/nearby observations and are not substituted for a curve.',
  source: 'Futures curve adapter roadmap',
});

export const MarketVolatilityPanel = quotePanel({
  title: 'Market Volatility',
  subtitle: 'Cross-asset volatility monitor.',
  symbols: ['^VIX','^VXN','^OVX','^GVZ'],
  note: 'Displayed indices are market volatility proxies. MOVE and FX implied-volatility surfaces require dedicated rate/FX volatility feeds.',
});

export const OptionsAnalyticsPanel = staticPanel({
  title: 'Options Analytics',
  subtitle: 'Options positioning, gamma and open-interest research.',
  note: 'GEX, put/call and strike-level open interest require an options-chain adapter. No option positioning is inferred from equity prices.',
  source: 'Options-chain adapter roadmap',
});

export const AssetsRatioPanel = staticPanel({
  title: 'Assets Ratio',
  subtitle: 'Relative-value two-leg asset analysis.',
  note: 'The ratio engine will support normalized price, percentile, z-score and historical analogs once multi-series history is exposed consistently.',
  source: 'Cross-asset analytics engine',
});

export const MarketCompositeSentimentPanel = quotePanel({
  title: 'Market Composite Sentiment',
  subtitle: 'Transparent cross-asset risk-on/risk-off context.',
  symbols: ['^GSPC','^TNX','GC=F','CL=F','BTCUSDT','DX-Y.NYB','^VIX'],
  note: 'This is a market-context monitor, not a proprietary 0–100 score yet. A scored model will publish its inputs and weights.',
});

export const MarketFlowPanel = quotePanel({
  title: 'Market Flow',
  subtitle: 'Cross-asset rotation and relative-strength monitor.',
  symbols: ['SPY','TLT','GLD','USO','BTCUSDT','EEM','^GSPC','^N225','^HSI','^JKSE'],
});

export const MarketRegimePanel = staticPanel({
  title: 'Market Regime Likelihood',
  subtitle: 'Macro regime and cross-asset driver framework.',
  note: 'Regime probabilities will be model outputs with disclosed methodology. Current build provides the research shell without invented probabilities.',
  source: 'Kuartal regime engine roadmap',
});

export const CotReportPanel = staticPanel({
  title: 'COT Report',
  subtitle: 'Futures positioning research.',
  note: 'Commitments of Traders data will be sourced from the CFTC and separated into net positioning, velocity and detail views.',
  source: 'CFTC adapter roadmap',
});

export const CtaPositioningPanel = staticPanel({
  title: 'CTA Positioning Report',
  subtitle: 'Systematic trend-positioning research.',
  note: 'CTA positioning is model-estimated in most commercial terminals. Kuartal will disclose its methodology before publishing a synthetic positioning series.',
  source: 'Systematic positioning model roadmap',
});

export const DumbMoneyPanel = staticPanel({
  title: 'Dumb Money Index',
  subtitle: 'Contrarian retail-positioning research.',
  note: 'Retail positioning requires a validated sentiment/positioning source. No arbitrary contrarian index is presented.',
  source: 'Positioning adapter roadmap',
});

export const OrderFlowPanel = staticPanel({
  title: 'Order Flow',
  subtitle: 'Microstructure workspace for aggressive flow and resting liquidity.',
  note: 'True order-flow analytics require venue-level trades and order-book events. The current crypto order book is the foundation; institutional-quality aggregation comes later.',
  source: 'Market microstructure adapter roadmap',
});

export const LiquidityStructurePanel = staticPanel({
  title: 'Liquidity Structure',
  subtitle: 'Pending-order and liquidity-concentration research.',
  note: 'Liquidity maps require depth snapshots and cancellation/placement events. The terminal does not infer hidden liquidity from candles.',
  source: 'Market microstructure adapter roadmap',
});

export const CentralBankDataPanel = staticPanel({
  title: 'Central Bank Data',
  subtitle: 'Policy-rate and central-bank research hub.',
  note: 'Official policy rates, decisions and forward guidance will be consolidated from central-bank sources.',
  source: 'Official central-bank feeds',
});

export const EconomicGrowthPanel = staticPanel({
  title: 'Economic Growth',
  subtitle: 'Multi-country growth data and nowcast research.',
  note: 'World Bank macro coverage is already available in Macro Compare. Nowcast/forecast layers will be added only as explicit model outputs.',
  source: 'World Bank + Kuartal model roadmap',
});

export const EmploymentDataPanel = staticPanel({
  title: 'Employment Data',
  subtitle: 'Labour-market and payroll research.',
  note: 'Official employment releases will be combined with transparent nowcast inputs. Forecasts will never be presented as official releases.',
  source: 'Official statistics adapter roadmap',
});

export const FedLiquidityPanel = staticPanel({
  title: 'Fed Net Liquidity',
  subtitle: 'Federal Reserve balance-sheet liquidity research.',
  note: 'Total assets, ON RRP, TGA and M2 components require synchronized official time series before a net-liquidity series is published.',
  source: 'Federal Reserve / Treasury / FRED roadmap',
});

export const FiscalDataPanel = staticPanel({
  title: 'Fiscal Data',
  subtitle: 'Government fiscal conditions and outlook research.',
  note: 'Fiscal balances, debt and issuance will use official government datasets and disclose frequency and revisions.',
  source: 'Official fiscal-data adapter roadmap',
});

export const InflationDataPanel = staticPanel({
  title: 'Inflation Data',
  subtitle: 'Multi-country inflation monitor and forecast shell.',
  note: 'Observed inflation comes from official statistics. Forecasts will be separately labeled as Kuartal model outputs.',
  source: 'Official statistics + Kuartal model roadmap',
});

export const MacroCountryPanel = staticPanel({
  title: 'Macro Data by Country',
  subtitle: 'Global macro matrix for comparing countries.',
  note: 'Use Macro Compare for the currently validated World Bank indicators. Additional high-frequency series will be added by country.',
  source: 'World Bank macro service',
});

export const MacroAgentPanel = staticPanel({
  title: 'Macroeconomic Agent',
  subtitle: 'Country-by-country macro comparison workspace.',
  note: 'This research shell is designed for future model-assisted comparison. Ask Kuartal remains Coming Soon until the self-hosted AI endpoint is connected.',
  source: 'Kuartal macro research engine',
});

export const MacroRegimePanel = staticPanel({
  title: 'Macroeconomic Regime',
  subtitle: 'Growth/inflation regime map: Goldilocks, Reflation, Stagflation, Recession.',
  note: 'The regime classification will be derived from validated country growth and inflation series with disclosed thresholds.',
  source: 'Kuartal macro regime engine',
});

export const RecessionProbabilityPanel = staticPanel({
  title: 'Recession Probability',
  subtitle: 'US recession-risk indicator workspace.',
  note: 'Sahm Rule, term spread and NBER chronology will be sourced from official/public datasets. Probabilities will be clearly labeled as model outputs.',
  source: 'FRED/NBER adapter roadmap',
});

export const GeopoliticalPanel = staticPanel({
  title: 'Geopolitical Intelligence',
  subtitle: 'Geopolitics, tariffs, sanctions and conflict research.',
  note: 'Events will be sourced from reputable public reporting and official releases, with timestamps and source attribution.',
  source: 'Geopolitical research pipeline',
});

export const GlobalTradePanel = staticPanel({
  title: 'Global Trade',
  subtitle: 'Official international-trade data workspace.',
  note: 'Trade flows will be connected to official customs/statistical sources before country-level numbers are displayed.',
  source: 'Official trade-data adapter roadmap',
});

export const PortActivityPanel = staticPanel({
  title: 'Port Activity',
  subtitle: 'Chokepoint and port-activity research.',
  note: 'Port and vessel activity requires AIS/maritime data. The terminal will distinguish observed vessel data from inferred congestion.',
  source: 'Maritime/AIS adapter roadmap',
});

const STREAMS = [
  { name: 'Bloomberg Television', handle: '@BloombergTelevision', url: 'https://www.youtube.com/@BloombergTelevision/live', note: 'Markets, business and global financial news' },
  { name: 'Yahoo Finance', handle: '@YahooFinance', url: 'https://www.youtube.com/@YahooFinance/live', note: 'Markets, earnings and finance programming' },
  { name: 'CNBC', handle: '@CNBC', url: 'https://www.youtube.com/@CNBC/live', note: 'Business and market coverage' },
  { name: 'Kuartal Live', handle: '@KuartalLive', url: 'https://www.youtube.com/@KuartalLive/live', note: 'Future 24/7 Kuartal-owned live channel' },
];

export function StreamingChannelsPanel({ report }: PanelProps) {
  const [active, setActive] = useState(0);
  useEffect(() => { report({ source: 'live', provider: 'YouTube channel links' }); }, [report]);
  const channel = STREAMS[active];
  return (
    <div className="streaming">
      <div className="toolbar"><b>Streaming Channels</b><span className="mono mute" style={{ marginLeft: 'auto' }}>YOUTUBE</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)', minHeight: 320 }}>
        <div style={{ borderRight: '1px solid var(--line)' }}>
          {STREAMS.map((s, i) => <button key={s.name} className={`cmd-item ${i === active ? 'on' : ''}`} style={{ width: '100%', display: 'block', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', color: 'inherit' }} onClick={() => setActive(i)}><b>{s.name}</b><div className="dim">{s.note}</div></button>)}
        </div>
        <div style={{ padding: 14 }}>
          <div className="section-label">LIVE CHANNEL</div>
          <h3 style={{ margin: '4px 0' }}>{channel.name}</h3>
          <p className="dim">{channel.note}</p>
          <div style={{ aspectRatio: '16/9', background: 'var(--panel-2)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
            <div><div className="mono" style={{ fontSize: 24 }}>▶</div><p className="dim">Open the channel's current live broadcast in YouTube.</p><a className="btn primary" href={channel.url} target="_blank" rel="noreferrer">Open Live Channel</a></div>
          </div>
          <p className="disclaimer">Kuartal links to the publisher's official YouTube channel. Availability and embedding are controlled by the publisher. Kuartal Live is reserved for the future first-party 24/7 stream.</p>
        </div>
      </div>
    </div>
  );
}

export const AnalystReportsPanel = staticPanel({ title: 'Analyst Reports', subtitle: 'Institutional research reader.', note: 'A document-ingestion reader will be connected to licensed/public research documents with source attribution.', source: 'Research document pipeline' });
export const EconomicCalendarPanel = staticPanel({ title: 'Economic Calendar', subtitle: 'Economic, earnings, IPO, dividend and holiday event calendar.', note: 'The calendar schema is reserved for official releases and validated market-event providers.', source: 'Economic calendar adapter roadmap' });
export const InstitutionalResearchPanel = staticPanel({ title: 'Institutional Research', subtitle: 'Institutional document viewer.', note: 'Research documents will be ingested with source, publication date and access metadata.', source: 'Research document pipeline' });
export const MarketResearchAgentPanel = staticPanel({ title: 'Market Research Agent', subtitle: 'Coming Soon.', note: 'The agent will be powered by the future self-hosted Kuartal AI stack. It is intentionally not represented as active AI today.', source: 'Kuartal AI roadmap' });
export const MorningBriefsPanel = staticPanel({ title: 'Morning Briefs', subtitle: 'Daily market briefing archive.', note: 'Briefs will become first-class Kuartal research documents once the publishing pipeline is connected.', source: 'Kuartal research publishing' });
export const NewsSummaryPanel = staticPanel({ title: 'News Summary', subtitle: 'Catalyst and narrative summarization workspace.', note: 'Summaries will use attributed source text and will be separated from the future AI summarizer.', source: 'News pipeline' });
export const SessionSummaryPanel = staticPanel({ title: 'Session Summary', subtitle: 'Trading-session headline and narrative workspace.', note: 'The existing News panel provides the source feed; session-specific narrative synthesis is a planned layer.', source: 'News/session engine roadmap' });
