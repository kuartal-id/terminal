/**
 * Response shapes for the research panels (technicals, US macro, official
 * feeds). Kept separate from shared/types.ts (the protected core contract) so
 * research features can evolve without touching it. Used by server and web.
 */

export type Read = 'positive' | 'negative' | 'neutral' | 'stretched';

export interface IndicatorReading {
  name: string;
  value: number;
  read: Read;
  note: string;
}

export interface TrendRead {
  trend: 'up' | 'down' | 'flat';
  momentum: 'strengthening' | 'weakening' | 'mixed';
  /** −100 … +100 composite of trend + momentum readings. Descriptive, not a signal. */
  score: number;
  rsi: number;
  macdHist: number;
  ema20: number | null;
  ema50: number | null;
  slopePct: number;
  adx: number | null;
}

export interface MeanReversionRead {
  price: number;
  mid: number;
  upper: number;
  lower: number;
  zScore: number;
  pctB: number;
  bandwidthPct: number;
  bandwidthPercentile: number;
  squeeze: boolean;
  state: 'extended-above' | 'upper-half' | 'near-mean' | 'lower-half' | 'extended-below';
}

export interface Level {
  price: number;
  touches: number;
  distancePct: number;
  barsAgo: number;
  strength: number;
}

export interface StructureRead {
  bias: 'uptrend' | 'downtrend' | 'range' | 'unclear';
  highs: 'HH' | 'LH' | null;
  lows: 'HL' | 'LL' | null;
  lastSwingHigh: number | null;
  lastSwingLow: number | null;
  break: string | null;
}

export type Timeframe = '1D' | '4H' | '15M';

export interface TimeframeAnalysis {
  tf: Timeframe;
  bars: number;
  price: number;
  indicators: IndicatorReading[];
  trend: TrendRead;
  meanReversion: MeanReversionRead;
  levels: { supports: Level[]; resistances: Level[] };
  structure: StructureRead;
  /** Last ~120 closes for a small chart. */
  closes: number[];
}

export interface TechnicalsResponse {
  symbol: string;
  label: string;
  frames: TimeframeAnalysis[];
}

export interface SeriesStats {
  observations: number;
  totalReturnPct: number;
  cagrPct: number;
  meanPct: number;
  volAnnPct: number;
  sharpe: number;
  skew: number;
  excessKurtosis: number;
  maxDrawdownPct: number;
  var95Pct: number;
  bestPct: number;
  worstPct: number;
  positivePct: number;
  histogram: { fromPct: number; count: number }[];
}

export interface RegressionStats {
  n: number;
  beta: number;
  alphaAnnPct: number;
  correlation: number;
  rSquared: number;
  upBeta: number | null;
  downBeta: number | null;
  trackingErrorPct: number;
  points: { x: number; y: number }[];
}

export interface RatioStats {
  current: number;
  mean: number;
  zScore: number;
  percentile: number;
  min: number;
  max: number;
  change1yPct: number | null;
  series: number[];
}

export interface RrgPoint {
  rsRatio: number;
  rsMomentum: number;
  quadrant: 'leading' | 'weakening' | 'lagging' | 'improving';
}

export interface BreadthStats {
  members: number;
  advancers: number;
  decliners: number;
  pctAbove50: number;
  pctAbove200: number;
  newHighs: number;
  newLows: number;
}

export interface PortfolioResult {
  finalValue: number;
  stats: SeriesStats;
  benchmark: SeriesStats | null;
  curve: number[];
  benchCurve?: number[];
}

/** One line in a comparison chart (normalised to 100 at the start). */
export interface CompareLine {
  symbol: string;
  label: string;
  values: number[];
  changePct: number;
}

export interface ComparisonResponse {
  times: number[];
  lines: CompareLine[];
}

export interface RotationRow {
  symbol: string;
  label: string;
  tail: RrgPoint[];
  change1mPct: number | null;
  change3mPct: number | null;
}

export interface VolRow {
  symbol: string;
  label: string;
  level: number | null;
  change1dPct: number | null;
  percentile1y: number | null;
  /** Realised volatility (annualised %) when computed from an underlying instead of an index. */
  realised?: boolean;
}

export interface TermPoint {
  symbol: string;
  label: string;
  price: number;
}

export interface TermCurve {
  root: string;
  name: string;
  points: TermPoint[];
  shape: 'contango' | 'backwardation' | 'flat' | 'mixed';
  spreadPct: number;
}

// ───────────── US macro (FRED) ─────────────

export interface MacroPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface MacroSeriesOut {
  id: string;
  name: string;
  units: string;
  frequency: string;
  latest: MacroPoint | null;
  previous: MacroPoint | null;
  change: number | null;
  /** 1y-ago comparable value (same frequency). */
  yearAgo: number | null;
  points: MacroPoint[];
}

export interface MacroGauge {
  /** 0–100 composite, higher = more stress / risk (meaning described per panel). */
  score: number;
  label: string;
  explain: string[];
}

export interface MacroDashboard {
  topic: string;
  series: MacroSeriesOut[];
  gauge?: MacroGauge;
  derived?: { name: string; units: string; latest: MacroPoint | null; points: MacroPoint[] }[];
}

// ───────────── Official / public feeds ─────────────

export interface CotRow {
  market: string;
  code: string;
  date: string;
  /** Speculative (non-commercial / managed money) net position, contracts. */
  netSpec: number;
  netSpecChange: number;
  /** Net as % of open interest. */
  netPctOi: number;
  /** Where today's net sits vs. its 3-year range, 0–100 (the "COT index"). */
  cotIndex: number;
  openInterest: number;
  history: { date: string; net: number }[];
}

export interface FundamentalsResponse {
  ticker: string;
  name: string;
  cik: string;
  currency: string;
  annual: { fy: number; end: string; revenue?: number; netIncome?: number; operatingIncome?: number; eps?: number; assets?: number; liabilities?: number; equity?: number; cash?: number; operatingCashFlow?: number; capex?: number }[];
  ratios: { name: string; value: number | null; units: string }[];
  filingsUrl: string;
}

export interface PredictionMarket {
  id: string;
  question: string;
  category: string | null;
  endDate: string | null;
  volume: number;
  liquidity: number;
  outcomes: { name: string; probability: number }[];
  url: string;
}

export interface SourceStatus {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
}
