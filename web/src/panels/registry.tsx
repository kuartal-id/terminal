import type { ComponentType } from 'react';
import type { PanelType } from '../lib/panels';
import { CorrelationPanel, SeasonalityPanel } from './analytics';
import { CryptoLive, OrderBook } from './crypto';
import { FxPanel, IdxMovers, MarketHours } from './indonesia';
import { MacroPanel, YieldCurvePanel } from './macro';
import { ChartPanel, MarketOverview, Watchlist } from './markets';
import { NewsPanel } from './news';
import { PulsePanel } from './pulse';
import { AskPanel, Calculators, GuidePanel } from './tools';
import { AssetHubPanel, BondsPanel, GlobalMarketsPanel, FundPanel, ScreenerPanel, SbnPanel, UsMarketsPanel } from './expanded';
import { EquityFactorPanel, EquityPricesPanel, IdxAuctionFlowPanel, IdxForeignFlowPanel, IdxOwnershipPanel, IdxStockScannerPanel, InstitutionalPortfoliosPanel, InvestorPortfoliosPanel, StockScreenerPanel, EtfDetailPanel, EtfFlowsPanel, EtfPricesPanel, EtfScreenerPanel, FxCarryPanel, ForexPricesPanel, FixedIncomePricesPanel, GlobalYieldCurvePanel, UsRatePricingPanel, CreditDefaultSwapPanel, CreditRatingsPanel, AgricultureWeatherPanel, CommodityPricesPanel, CrudeOilFundamentalPanel, GoldFundamentalPanel, GoldIntermarketPanel, CryptoScannerPanel, CryptoNarrativesPanel, CryptoWhalePanel, CryptoPricesPanel, LiquidationMapPanel, OptionsAnalyticsPanel, MarketCompositeSentimentPanel, MarketFlowPanel, MarketRegimePanel, CtaPositioningPanel, DumbMoneyPanel, OrderFlowPanel, LiquidityStructurePanel, CentralBankDataPanel, MacroCountryPanel, MacroAgentPanel, MacroRegimePanel, GeopoliticalPanel, GlobalTradePanel, PortActivityPanel, StreamingChannelsPanel, AnalystReportsPanel, EconomicCalendarPanel, InstitutionalResearchPanel, MarketResearchAgentPanel, MorningBriefsPanel, NewsSummaryPanel, SessionSummaryPanel, GeopoliticalRiskMapPanel, News24Panel, CryptoNewsPanel, MarketArticlesPanel, ChartPatternPanel, ChartPredictionPanel, LiveChartPanel, CustomBacktestPanel, FxCommoditySignalPanel, SmartDecisionPanel, PortfolioMonitorPanel, RegimeAllocatorPanel, TradingJournalPanel, MarketReportBuilderPanel, MarketWidgetsPanel, WeekendMarketPanel } from './research';
import { technicalPanel } from './technical';
import { BetaPanel, BreadthPanel, ComparisonPanel, CreditSentimentPanel as QCreditSentimentPanel, FxStrengthPanel as QFxStrengthPanel, PortfolioSimPanel, RatioPanel, RotationPanel, StatsPanel, TermStructurePanel, VolatilityPanel } from './quant';
import { CotPanel, FundamentalsPanel, macroTopicPanel, PredictionPanel } from './usmacro';
import type { PanelProps } from './types';

// Real-data research panels (Claude, 2026-10-09). Created once at module load so
// React sees stable component identities.
const TECH_IND = technicalPanel('indicators');
const TECH_TREND = technicalPanel('trend');
const TECH_MEANREV = technicalPanel('meanrev');
const TECH_LEVELS = technicalPanel('levels');
const TECH_STRUCTURE = technicalPanel('structure');
const MACRO_REAL = macroTopicPanel('real-yields');
const MACRO_LIQ = macroTopicPanel('liquidity', false);
const MACRO_REC = macroTopicPanel('recession');
const MACRO_EMP = macroTopicPanel('employment');
const MACRO_INF = macroTopicPanel('inflation');
const MACRO_FUNDING = macroTopicPanel('funding');
const MACRO_FISCAL = macroTopicPanel('fiscal');
const MACRO_GROWTH = macroTopicPanel('growth');

/** Panel type → component. Metadata (titles, sizes, keywords) lives in lib/panels.ts. */
export const PANEL_COMPONENTS: Record<PanelType, ComponentType<PanelProps>> = {
  OVR: MarketOverview,
  PLS: PulsePanel,
  IDX: IdxMovers,
  CHT: ChartPanel,
  WL: Watchlist,
  NWS: NewsPanel,
  FX: FxPanel,
  YC: YieldCurvePanel,
  MAC: MacroPanel,
  CRY: CryptoLive,
  BOOK: OrderBook,
  CAL: Calculators,
  CLK: MarketHours,
  COR: CorrelationPanel,
  SEA: SeasonalityPanel,
  ASK: AskPanel,
  HELP: GuidePanel,
  USA: UsMarketsPanel,
  GLO: GlobalMarketsPanel,
  BND: BondsPanel,
  SBN: SbnPanel,
  FND: FundPanel,
  SCR: ScreenerPanel,
  HUB: AssetHubPanel,
  CFD: FundamentalsPanel,
  EFS: EquityFactorPanel,
  EQP: EquityPricesPanel,
  IAF: IdxAuctionFlowPanel,
  IFF: IdxForeignFlowPanel,
  IOW: IdxOwnershipPanel,
  ISS: IdxStockScannerPanel,
  IPP: InstitutionalPortfoliosPanel,
  IVP: InvestorPortfoliosPanel,
  BRD: BreadthPanel,
  STK: StockScreenerPanel,
  ROT: RotationPanel,
  ETD: EtfDetailPanel,
  ETF: EtfFlowsPanel,
  ETP: EtfPricesPanel,
  ETS: EtfScreenerPanel,
  DFS: MACRO_FUNDING,
  FCA: FxCarryPanel,
  FXS: QFxStrengthPanel,
  FXP: ForexPricesPanel,
  FIP: FixedIncomePricesPanel,
  GYC: GlobalYieldCurvePanel,
  URP: UsRatePricingPanel,
  URY: MACRO_REAL,
  CDS: CreditDefaultSwapPanel,
  CMS: QCreditSentimentPanel,
  CRR: CreditRatingsPanel,
  AGW: AgricultureWeatherPanel,
  CMD: CommodityPricesPanel,
  OIL: CrudeOilFundamentalPanel,
  GLF: GoldFundamentalPanel,
  GIS: GoldIntermarketPanel,
  CLS: CryptoScannerPanel,
  CNT: CryptoNarrativesPanel,
  CWT: CryptoWhalePanel,
  CPR: CryptoPricesPanel,
  LQM: LiquidationMapPanel,
  FTS: TermStructurePanel,
  VOL: VolatilityPanel,
  OPT: OptionsAnalyticsPanel,
  ARR: RatioPanel,
  MCS: MarketCompositeSentimentPanel,
  MFL: MarketFlowPanel,
  MRL: MarketRegimePanel,
  COT: CotPanel,
  CTA: CtaPositioningPanel,
  DMI: DumbMoneyPanel,
  OFL: OrderFlowPanel,
  LST: LiquidityStructurePanel,
  CBD: CentralBankDataPanel,
  EGW: MACRO_GROWTH,
  EMP: MACRO_EMP,
  FNL: MACRO_LIQ,
  FIS: MACRO_FISCAL,
  INF: MACRO_INF,
  MCY: MacroCountryPanel,
  MGA: MacroAgentPanel,
  MGR: MacroRegimePanel,
  REC: MACRO_REC,
  GPI: GeopoliticalPanel,
  GTM: GlobalTradePanel,
  POR: PortActivityPanel,
  STR: StreamingChannelsPanel,
  ANR: AnalystReportsPanel,
  ECO: EconomicCalendarPanel,
  INR: InstitutionalResearchPanel,
  MRA: MarketResearchAgentPanel,
  MOR: MorningBriefsPanel,
  NSM: NewsSummaryPanel,
  SES: SessionSummaryPanel,
  GRM: GeopoliticalRiskMapPanel,
  NEW: News24Panel,
  CNW: CryptoNewsPanel,
  ART: MarketArticlesPanel,
  CHC: ComparisonPanel,
  CPS: ChartPatternPanel,
  CPM: ChartPredictionPanel,
  LVC: LiveChartPanel,
  MST: TECH_STRUCTURE,
  MRV: TECH_MEANREV,
  SAR: TECH_LEVELS,
  TIN: TECH_IND,
  TRM: TECH_TREND,
  BTL: CustomBacktestPanel,
  FCS: FxCommoditySignalPanel,
  SDS: SmartDecisionPanel,
  PTM: PortfolioMonitorPanel,
  PTS: PortfolioSimPanel,
  RBA: RegimeAllocatorPanel,
  RBA2: BetaPanel,
  TRJ: TradingJournalPanel,
  MRB: MarketReportBuilderPanel,
  MWG: MarketWidgetsPanel,
  PMK: PredictionPanel,
  STA: StatsPanel,
  WEM: WeekendMarketPanel,
};
