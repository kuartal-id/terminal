/**
 * Panel catalogue (metadata only — components live in panels/registry.tsx).
 * Adding a panel = add an entry here + a component in registry.tsx.
 * NEVER rename or reuse an existing `type` code: saved workspaces in users'
 * browsers refer to these codes. See AGENTS.md → "Stable contracts".
 */

export type PanelType =
  | 'OVR' | 'PLS' | 'IDX' | 'CHT' | 'WL' | 'NWS' | 'FX' | 'YC' | 'MAC'
  | 'CRY' | 'BOOK' | 'CAL' | 'CLK' | 'COR' | 'SEA' | 'ASK' | 'HELP';

export type Category = 'Markets' | 'Indonesia' | 'Macro' | 'Crypto' | 'Analytics' | 'Tools';

export interface PanelMeta {
  type: PanelType;
  title: string;
  description: string;
  category: Category;
  pro?: boolean;
  /** Default grid size (12-column grid, 28px rows). */
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  keywords: string[];
  /** Panel accepts a symbol param (enables "BBCA GP"-style commands). */
  takesSymbol?: boolean;
}

export const PANELS: Record<PanelType, PanelMeta> = {
  PLS: { type: 'PLS', title: 'Kuartal Pulse', description: 'Transparent risk-appetite score with an Indonesia lens', category: 'Markets', w: 6, h: 11, minW: 4, minH: 8, keywords: ['pulse', 'regime', 'risk', 'sentiment', 'risk on', 'risk off', 'mood'] },
  OVR: { type: 'OVR', title: 'Market Overview', description: 'Indonesia, Asia, US/EU, FX, commodities, rates, crypto', category: 'Markets', w: 6, h: 14, minW: 3, minH: 6, keywords: ['overview', 'markets', 'monitor', 'indices', 'snapshot', 'world'] },
  CHT: { type: 'CHT', title: 'Chart', description: 'Candles, volume, moving averages, RSI', category: 'Markets', w: 6, h: 13, minW: 4, minH: 8, keywords: ['chart', 'graph', 'candle', 'price', 'gp', 'technical'], takesSymbol: true },
  WL: { type: 'WL', title: 'Watchlist', description: 'Your saved symbols with sparklines', category: 'Markets', w: 4, h: 10, minW: 3, minH: 5, keywords: ['watchlist', 'favorites', 'favourites', 'saved', 'portfolio'] },
  NWS: { type: 'NWS', title: 'News', description: 'Headlines from Indonesian and global public feeds', category: 'Markets', w: 4, h: 14, minW: 3, minH: 6, keywords: ['news', 'headlines', 'berita', 'top'] },
  IDX: { type: 'IDX', title: 'IDX Movers', description: 'LQ45 table and heatmap', category: 'Indonesia', w: 6, h: 13, minW: 4, minH: 6, keywords: ['idx', 'lq45', 'indonesia', 'saham', 'stocks', 'movers', 'heatmap', 'banks', 'jakarta'] },
  FX: { type: 'FX', title: 'FX Board', description: 'Rupiah and major currencies, ECB reference rates', category: 'Indonesia', w: 4, h: 12, minW: 3, minH: 6, keywords: ['fx', 'forex', 'currency', 'currencies', 'rupiah', 'idr', 'kurs', 'dollar'] },
  CLK: { type: 'CLK', title: 'Market Hours', description: 'World exchange sessions in your local time', category: 'Indonesia', w: 6, h: 9, minW: 4, minH: 6, keywords: ['clock', 'hours', 'sessions', 'open', 'close', 'time'] },
  YC: { type: 'YC', title: 'US Yield Curve', description: 'Treasury curve vs 1M and 1Y ago, 10Y–2Y spread', category: 'Macro', w: 5, h: 11, minW: 4, minH: 7, keywords: ['yield', 'curve', 'treasury', 'bonds', 'rates', 'inversion', 'ust'] },
  MAC: { type: 'MAC', title: 'Macro Compare', description: 'World Bank indicators across ASEAN and beyond', category: 'Macro', w: 7, h: 12, minW: 4, minH: 8, keywords: ['macro', 'gdp', 'inflation', 'economy', 'asean', 'compare countries', 'world bank', 'unemployment', 'fdi'] },
  CRY: { type: 'CRY', title: 'Crypto Live', description: 'Streaming crypto prices', category: 'Crypto', w: 4, h: 10, minW: 3, minH: 5, keywords: ['crypto', 'bitcoin', 'btc', 'eth', 'kripto', 'live'] },
  BOOK: { type: 'BOOK', title: 'Order Book', description: 'Live depth ladder for crypto pairs', category: 'Crypto', w: 3, h: 14, minW: 3, minH: 8, keywords: ['order book', 'depth', 'book', 'bids', 'asks', 'ladder'], takesSymbol: true },
  COR: { type: 'COR', title: 'Correlation', description: 'Rolling correlation matrix across assets', category: 'Analytics', pro: true, w: 6, h: 12, minW: 4, minH: 8, keywords: ['correlation', 'relationship', 'matrix', 'compare'] },
  SEA: { type: 'SEA', title: 'Seasonality', description: 'Monthly return history and hit-rates', category: 'Analytics', pro: true, w: 7, h: 12, minW: 5, minH: 8, keywords: ['seasonality', 'seasonal', 'monthly', 'calendar effect'], takesSymbol: true },
  ASK: { type: 'ASK', title: 'Ask Kuartal', description: 'Assistant that drives the terminal for you', category: 'Tools', w: 4, h: 12, minW: 3, minH: 7, keywords: ['ask', 'ai', 'assistant', 'help me', 'kuartal ai'] },
  CAL: { type: 'CAL', title: 'Calculators', description: 'IDX lots & fees, position sizing, compounding', category: 'Tools', w: 6, h: 12, minW: 4, minH: 8, keywords: ['calculator', 'kalkulator', 'fees', 'lot', 'position size', 'compound', 'dca'] },
  HELP: { type: 'HELP', title: 'Terminal Guide', description: 'Commands, shortcuts and data sources', category: 'Tools', w: 5, h: 13, minW: 3, minH: 6, keywords: ['help', 'guide', 'commands', 'how', 'shortcuts', 'sources'] },
};

export const PANEL_ORDER: PanelType[] = ['PLS', 'OVR', 'CHT', 'WL', 'NWS', 'IDX', 'FX', 'CLK', 'YC', 'MAC', 'CRY', 'BOOK', 'COR', 'SEA', 'ASK', 'CAL', 'HELP'];

export const CATEGORIES: Category[] = ['Markets', 'Indonesia', 'Macro', 'Crypto', 'Analytics', 'Tools'];
