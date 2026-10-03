/**
 * Types shared by the API server (server/) and the web app (web/).
 * This file is the contract between the two — change it carefully and
 * update both sides in the same commit. See AGENTS.md "Stable contracts".
 */

/** Where a piece of data came from. Every API response says this so the UI can label it honestly. */
export type DataSource = 'live' | 'delayed' | 'eod' | 'demo' | 'static';

export interface Envelope<T> {
  data: T;
  /** Worst-case source across the payload (e.g. one demo quote makes the envelope "demo"). */
  source: DataSource;
  provider: string;
  asOf: string;
  note?: string;
}

export type AssetClass = 'index' | 'equity' | 'fx' | 'commodity' | 'crypto' | 'rate' | 'etf';

export interface Instrument {
  /** Provider symbol (Yahoo-style for most, e.g. "BBCA.JK", "^JKSE", "IDR=X"; Binance style "BTCUSDT" for crypto). */
  symbol: string;
  /** Short label shown in the UI, e.g. "IHSG", "USD/IDR". */
  label: string;
  name: string;
  assetClass: AssetClass;
  group: string;
  currency?: string;
  /** Inverted display (e.g. show a yield in %, not price). */
  unit?: '%' | 'pts';
}

export interface Quote {
  symbol: string;
  label: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePct: number;
  prevClose: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  currency?: string;
  /** Unix ms of last price. */
  time: number;
  source: DataSource;
  /** Recent closes for sparklines (oldest → newest). */
  spark?: number[];
}

export interface Candle {
  /** Unix seconds (lightweight-charts convention). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface History {
  symbol: string;
  label: string;
  interval: string;
  range: string;
  candles: Candle[];
  currency?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  source: string;
  /** ISO timestamp. */
  published: string;
  region: 'id' | 'global';
  topics: string[];
}

export interface FxBoard {
  base: string;
  date: string;
  rates: Record<string, number>;
  /** Same rates one month earlier, for change calculation. */
  prior?: { date: string; rates: Record<string, number> };
}

export interface YieldPoint {
  tenor: string;
  months: number;
  value: number;
}

export interface YieldCurve {
  date: string;
  points: YieldPoint[];
  compare: { label: string; date: string; points: YieldPoint[] }[];
}

export interface MacroSeries {
  country: string;
  countryName: string;
  indicator: string;
  indicatorName: string;
  points: { year: number; value: number | null }[];
}

export interface PulseComponent {
  key: string;
  label: string;
  /** 0–100, higher = more risk appetite. */
  score: number;
  weight: number;
  reading: string;
}

export type PulseRegime = 'Risk-Off' | 'Cautious' | 'Neutral' | 'Constructive' | 'Risk-On';

export interface PulseReport {
  score: number;
  regime: PulseRegime;
  components: PulseComponent[];
  indonesia: { score: number; regime: PulseRegime; components: PulseComponent[] };
  narrative: string[];
  methodology: string;
}

export interface CorrelationMatrix {
  labels: string[];
  symbols: string[];
  window: number;
  matrix: number[][];
}

export interface SeasonalityRow {
  year: number;
  months: (number | null)[];
}

export interface Seasonality {
  symbol: string;
  label: string;
  rows: SeasonalityRow[];
  average: (number | null)[];
  hitRate: (number | null)[];
}

export type Tier = 'guest' | 'free' | 'pro';

export interface Me {
  authenticated: boolean;
  /** False when Kuartal ID client credentials aren't set on the server yet. */
  authConfigured: boolean;
  tier: Tier;
  sub?: string;
  name?: string;
  email?: string;
  entitlements: string[];
  /** May use the terminal at all (signed in with Kuartal ID + terminal.access, or login not required). */
  access: boolean;
  /** Server requires Kuartal ID login + terminal.access to use the terminal. */
  loginRequired: boolean;
  loginUrl: string;
  logoutUrl: string;
  upgradeUrl: string;
}

export interface ApiError {
  error: string;
  code: 'not_found' | 'bad_request' | 'premium_required' | 'login_required' | 'access_required' | 'upstream';
}
