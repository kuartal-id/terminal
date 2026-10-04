/**
 * Panel catalogue (metadata only — components live in panels/registry.tsx).
 * Adding a panel = add an entry here + a component in registry.tsx.
 * NEVER rename or reuse an existing `type` code: saved workspaces in users'
 * browsers refer to these codes. See AGENTS.md → "Stable contracts".
 */

export type PanelType =
  | 'OVR' | 'PLS' | 'IDX' | 'CHT' | 'WL' | 'NWS' | 'FX' | 'YC' | 'MAC'
  | 'CRY' | 'BOOK' | 'CAL' | 'CLK' | 'COR' | 'SEA' | 'ASK' | 'HELP'
  | 'USA' | 'GLO' | 'BND' | 'SBN' | 'FND' | 'SCR' | 'HUB';
  | 'CFD' | 'EFS' | 'EQP' | 'IAF' | 'IFF' | 'IOW' | 'ISS' | 'IPP' | 'IVP' | 'BRD' | 'STK' | 'ROT' | 'ETD' | 'ETF' | 'ETP' | 'ETS' | 'DFS' | 'FCA' | 'FXS' | 'FXP' | 'FIP' | 'GYC' | 'URP' | 'URY' | 'CDS' | 'CMS' | 'CRR' | 'AGW' | 'CMD' | 'OIL' | 'GLF' | 'GIS' | 'CLS' | 'CNT' | 'CWT' | 'CPR' | 'LQM' | 'FTS' | 'VOL' | 'OPT' | 'ARR' | 'MCS' | 'MFL' | 'MRL' | 'COT' | 'CTA' | 'DMI' | 'OFL' | 'LST' | 'CBD' | 'EGW' | 'EMP' | 'FNL' | 'FIS' | 'INF' | 'MCY' | 'MGA' | 'MGR' | 'REC' | 'GPI' | 'GTM' | 'POR' | 'STR' | 'ANR' | 'ECO' | 'INR' | 'MRA' | 'MOR' | 'NSM' | 'SES' | 'GRM' | 'NEW' | 'CNW' | 'ART' | 'CHC' | 'CPS' | 'CPM' | 'LVC' | 'MST' | 'MRV' | 'SAR' | 'TIN' | 'TRM' | 'BTL' | 'FCS' | 'SDS' | 'PTM' | 'PTS' | 'RBA' | 'RBA2' | 'TRJ' | 'MRB' | 'MWG' | 'PMK' | 'STA' | 'WEM';

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
  USA: { type: 'USA', title: 'US Markets', description: 'US indices, equities and ETFs', category: 'Markets', w: 7, h: 14, minW: 4, minH: 8, keywords: ['usa', 'us', 'america', 'american', 'nasdaq', 's&p', 'dow', 'stocks', 'equities'] },
  GLO: { type: 'GLO', title: 'Global Markets', description: 'ASEAN, Europe, Asia-Pacific, Canada, London and Saudi Arabia benchmarks', category: 'Markets', w: 8, h: 16, minW: 5, minH: 9, keywords: ['global', 'world', 'asean', 'europe', 'asia', 'japan', 'korea', 'hong kong', 'india', 'china', 'canada', 'london', 'saudi', 'markets'] },
  BND: { type: 'BND', title: 'Bonds & Rates', description: 'Treasuries, bond ETFs and rates', category: 'Macro', w: 6, h: 14, minW: 4, minH: 8, keywords: ['bond', 'bonds', 'treasury', 'rates', 'fixed income', 'yield'] },
  SBN: { type: 'SBN', title: 'Indonesia SBN', description: 'SUN, SBSN, SBN Ritel and government bond research', category: 'Indonesia', w: 6, h: 12, minW: 4, minH: 7, keywords: ['sbn', 'sun', 'sbsn', 'ori', 'sbr', 'sr', 'st', 'government bonds', 'obligasi negara'] },
  FND: { type: 'FND', title: 'Funds & Fixed Income', description: 'Reksa dana and fixed-income research hub', category: 'Indonesia', w: 6, h: 14, minW: 4, minH: 8, keywords: ['reksadana', 'reksa dana', 'money market', 'pasar uang', 'obligasi', 'fixed income', 'fund'] },
  SCR: { type: 'SCR', title: 'Market Screener', description: 'Free-feed quote and momentum scanner for IDX and USA', category: 'Analytics', pro: true, w: 7, h: 14, minW: 4, minH: 8, keywords: ['screener', 'scanner', 'screen', 'momentum', 'rank', 'filter'] },
  HUB: { type: 'HUB', title: 'Asset Class Hub', description: 'Navigate equities, rates, funds and cross-asset research', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['asset classes', 'assets', 'research', 'hub', 'terminal'] },
  CFD: { type: 'CFD', title: 'Company Fundamentals', description: 'Fundamental research workspace for USA and IDX equities.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['company fundamentals'] },
  EFS: { type: 'EFS', title: 'Equity Factor Scoring', description: 'Transparent multifactor equity ranking workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['equity factor scoring'] },
  EQP: { type: 'EQP', title: 'Equity Prices', description: 'Cross-market equity price matrix for USA and IDX.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['equity prices'] },
  IAF: { type: 'IAF', title: 'IDX Auction Flow', description: 'IDX closing-auction flow research workspace.', category: 'Indonesia', w: 6, h: 12, minW: 4, minH: 7, keywords: ['idx auction flow'] },
  IFF: { type: 'IFF', title: 'IDX Foreign Flow', description: 'IDX foreign-flow research workspace.', category: 'Indonesia', w: 6, h: 12, minW: 4, minH: 7, keywords: ['idx foreign flow'] },
  IOW: { type: 'IOW', title: 'IDX Ownership', description: 'IDX ownership and investor structure research.', category: 'Indonesia', w: 6, h: 12, minW: 4, minH: 7, keywords: ['idx ownership'] },
  ISS: { type: 'ISS', title: 'IDX Stock Scanner', description: 'IDX stock radar and quote scanner.', category: 'Indonesia', w: 6, h: 12, minW: 4, minH: 7, keywords: ['idx stock scanner'] },
  IPP: { type: 'IPP', title: 'Institutional Portfolios', description: '13F institutional portfolio research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['institutional portfolios'] },
  IVP: { type: 'IVP', title: 'Investor Portfolios', description: 'Investor and portfolio-manager research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['investor portfolios'] },
  BRD: { type: 'BRD', title: 'Market Breadth', description: 'Equity breadth and internals monitor.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market breadth'] },
  STK: { type: 'STK', title: 'Stock Screener', description: 'Combined USA and IDX equity screener.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['stock screener'] },
  ROT: { type: 'ROT', title: 'Sector Rotation', description: 'Theme and sector rotation monitor.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['sector rotation'] },
  ETD: { type: 'ETD', title: 'ETF Detail', description: 'Per-ticker ETF research workspace.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['etf detail'] },
  ETF: { type: 'ETF', title: 'ETF Flows', description: 'ETF creations, redemptions and flow research.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['etf flows'] },
  ETP: { type: 'ETP', title: 'ETF Prices', description: 'ETF price research matrix.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['etf prices'] },
  ETS: { type: 'ETS', title: 'ETF Screener', description: 'ETF screening workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['etf screener'] },
  DFS: { type: 'DFS', title: 'Dollar Funding Stress', description: 'Dollar funding and liquidity stress monitor.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['dollar funding stress'] },
  FCA: { type: 'FCA', title: 'FX Carry', description: 'FX carry and valuation workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fx carry'] },
  FXS: { type: 'FXS', title: 'FX Strength', description: 'Currency strength and momentum monitor.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fx strength'] },
  FXP: { type: 'FXP', title: 'Forex Prices', description: 'Major, minor and emerging FX reference matrix.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['forex prices'] },
  FIP: { type: 'FIP', title: 'Fixed Income Prices', description: 'Global fixed-income price and yield monitor.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fixed income prices'] },
  GYC: { type: 'GYC', title: 'Global Yield Curve', description: 'Sovereign yield-curve comparison workspace.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['global yield curve'] },
  URP: { type: 'URP', title: 'US Rate Pricing', description: 'Market-implied Federal Reserve path research.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['us rate pricing'] },
  URY: { type: 'URY', title: 'US Real Yields', description: 'US Treasury real-yield monitor.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['us real yields'] },
  CDS: { type: 'CDS', title: 'Credit Default Swap', description: 'Sovereign CDS risk monitor.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['credit default swap'] },
  CMS: { type: 'CMS', title: 'Credit Market Sentiment', description: 'HY/IG credit risk-premium workspace.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['credit market sentiment'] },
  CRR: { type: 'CRR', title: 'Credit Ratings', description: 'Sovereign credit-ratings comparison.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['credit ratings'] },
  AGW: { type: 'AGW', title: 'Agriculture Weather', description: 'Agricultural production-region weather research.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['agriculture weather'] },
  CMD: { type: 'CMD', title: 'Commodity Prices', description: 'Energy, metals and agriculture futures monitor.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['commodity prices'] },
  OIL: { type: 'OIL', title: 'Crude Oil Fundamental', description: 'Physical oil balance and macro research.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crude oil fundamental'] },
  GLF: { type: 'GLF', title: 'Gold Fundamental', description: 'Gold supply, demand, reserves and ETF research.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['gold fundamental'] },
  GIS: { type: 'GIS', title: 'Gold Intermarket', description: 'Gold, rates, dollar and risk intermarket monitor.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['gold intermarket'] },
  CLS: { type: 'CLS', title: 'Crypto Live Scanner', description: 'Live crypto momentum and activity scanner.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crypto live scanner'] },
  CNT: { type: 'CNT', title: 'Crypto Narratives', description: 'Crypto narrative and trend research.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crypto narratives'] },
  CWT: { type: 'CWT', title: 'Crypto Whale', description: 'Large-wallet and perpetual-position research.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crypto whale'] },
  CPR: { type: 'CPR', title: 'Crypto Prices', description: 'Major crypto asset price matrix.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crypto prices'] },
  LQM: { type: 'LQM', title: 'Liquidation Map', description: 'Crypto liquidation concentration research.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['liquidation map'] },
  FTS: { type: 'FTS', title: 'Futures Term Structure', description: 'Futures curve and carry research.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['futures term structure'] },
  VOL: { type: 'VOL', title: 'Market Volatility', description: 'Cross-asset volatility monitor.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market volatility'] },
  OPT: { type: 'OPT', title: 'Options Analytics', description: 'Options positioning and gamma research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['options analytics'] },
  ARR: { type: 'ARR', title: 'Assets Ratio', description: 'Two-leg cross-asset relative-value analysis.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['assets ratio'] },
  MCS: { type: 'MCS', title: 'Market Composite Sentiment', description: 'Cross-asset risk-on/risk-off context.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market composite sentiment'] },
  MFL: { type: 'MFL', title: 'Market Flow', description: 'Cross-asset rotation and flow context.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market flow'] },
  MRL: { type: 'MRL', title: 'Market Regime', description: 'Macro regime and cross-asset driver framework.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market regime'] },
  COT: { type: 'COT', title: 'COT Report', description: 'CFTC futures positioning research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['cot report'] },
  CTA: { type: 'CTA', title: 'CTA Positioning', description: 'Systematic trend-positioning research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['cta positioning'] },
  DMI: { type: 'DMI', title: 'Dumb Money', description: 'Contrarian retail-positioning research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['dumb money'] },
  OFL: { type: 'OFL', title: 'Order Flow', description: 'Microstructure and aggressive-flow research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['order flow'] },
  LST: { type: 'LST', title: 'Liquidity Structure', description: 'Pending-order and liquidity-concentration research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['liquidity structure'] },
  CBD: { type: 'CBD', title: 'Central Bank Data', description: 'Global central-bank policy-rate research hub.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['central bank data'] },
  EGW: { type: 'EGW', title: 'Economic Growth', description: 'Multi-country growth and nowcast research.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['economic growth'] },
  EMP: { type: 'EMP', title: 'Employment Data', description: 'Labour-market and payroll research.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['employment data'] },
  FNL: { type: 'FNL', title: 'Fed Net Liquidity', description: 'Federal Reserve liquidity research.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fed net liquidity'] },
  FIS: { type: 'FIS', title: 'Fiscal Data', description: 'Government fiscal conditions research.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fiscal data'] },
  INF: { type: 'INF', title: 'Inflation Data', description: 'Multi-country inflation monitor.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['inflation data'] },
  MCY: { type: 'MCY', title: 'Macro Country', description: 'Global macro data matrix by country.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['macro country'] },
  MGA: { type: 'MGA', title: 'Macroeconomic Agent', description: 'Country-by-country macro comparison workspace.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['macroeconomic agent'] },
  MGR: { type: 'MGR', title: 'Macroeconomic Regime', description: 'Growth/inflation regime map.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['macroeconomic regime'] },
  REC: { type: 'REC', title: 'Recession Probability', description: 'US recession-risk indicator workspace.', category: 'Macro', w: 6, h: 12, minW: 4, minH: 7, keywords: ['recession probability'] },
  GPI: { type: 'GPI', title: 'Geopolitical Intelligence', description: 'Geopolitics, tariffs, sanctions and conflict research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['geopolitical intelligence'] },
  GTM: { type: 'GTM', title: 'Global Trade', description: 'International trade data workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['global trade'] },
  POR: { type: 'POR', title: 'Port Activity', description: 'Ports, chokepoints and maritime activity research.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['port activity'] },
  STR: { type: 'STR', title: 'Streaming Channels', description: 'Live finance TV and future Kuartal Live channel hub.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['streaming channels'] },
  ANR: { type: 'ANR', title: 'Analyst Reports', description: 'Institutional and analyst research reader.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['analyst reports'] },
  ECO: { type: 'ECO', title: 'Economic Calendar', description: 'Economic, earnings, IPO, dividend and holiday calendar.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['economic calendar'] },
  INR: { type: 'INR', title: 'Institutional Research', description: 'Institutional research document viewer.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['institutional research'] },
  MRA: { type: 'MRA', title: 'Market Research Agent', description: 'Coming-soon market research agent.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market research agent'] },
  MOR: { type: 'MOR', title: 'Morning Briefs', description: 'Daily market briefing archive.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['morning briefs'] },
  NSM: { type: 'NSM', title: 'News Summary', description: 'Market catalyst and narrative summary workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['news summary'] },
  SES: { type: 'SES', title: 'Session Summary', description: 'Trading-session headline and narrative workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['session summary'] },
  GRM: { type: 'GRM', title: 'Geopolitical Risk Map', description: 'Geopolitical risk events and chokepoints map.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['geopolitical risk map'] },
  NEW: { type: 'NEW', title: '24/7 News', description: 'Breaking financial headlines workspace.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['24/7 news'] },
  CNW: { type: 'CNW', title: 'Crypto News', description: 'Digital-asset news workspace.', category: 'Crypto', w: 6, h: 12, minW: 4, minH: 7, keywords: ['crypto news'] },
  ART: { type: 'ART', title: 'Market Articles', description: 'Lead story and intelligence feed.', category: 'Research', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market articles'] },
  CHC: { type: 'CHC', title: 'Chart Comparison', description: 'Normalized and price-scale chart comparison.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['chart comparison'] },
  CPS: { type: 'CPS', title: 'Chart Pattern Signal', description: 'Chart-pattern research scanner.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['chart pattern signal'] },
  CPM: { type: 'CPM', title: 'Chart Prediction Model', description: 'Scenario analysis for chart context.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['chart prediction model'] },
  LVC: { type: 'LVC', title: 'Live Chart', description: 'Interactive live chart workspace.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['live chart'] },
  MST: { type: 'MST', title: 'Market Structure', description: 'Multi-timeframe market-structure analyzer.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market structure'] },
  MRV: { type: 'MRV', title: 'Mean Reversion', description: 'Multi-timeframe mean-reversion analyzer.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['mean reversion'] },
  SAR: { type: 'SAR', title: 'Support & Resistance', description: 'Multi-timeframe support and resistance analyzer.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['support & resistance'] },
  TIN: { type: 'TIN', title: 'Technical Indicators', description: 'Technical indicator dashboard.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['technical indicators'] },
  TRM: { type: 'TRM', title: 'Trend & Momentum', description: 'Multi-timeframe trend and momentum analyzer.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['trend & momentum'] },
  BTL: { type: 'BTL', title: 'Custom Strategy Backtest', description: 'Historical strategy testing lab.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['custom strategy backtest'] },
  FCS: { type: 'FCS', title: 'FX & Commodity Signal', description: 'Cross-market FX and commodity signal table.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['fx & commodity signal'] },
  SDS: { type: 'SDS', title: 'Smart Decision Signal', description: 'Visual decision-analysis workspace.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['smart decision signal'] },
  PTM: { type: 'PTM', title: 'Portfolio Monitor', description: 'Holdings, allocation and drawdown workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['portfolio monitor'] },
  PTS: { type: 'PTS', title: 'Portfolio Simulator', description: 'Portfolio allocation and rebalancing simulator.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['portfolio simulator'] },
  RBA: { type: 'RBA', title: 'Regime-Based Allocator', description: 'Dynamic regime-based allocation framework.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['regime-based allocator'] },
  RBA2: { type: 'RBA2', title: 'Risk & Beta Analysis', description: 'Beta and benchmark-risk workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['risk & beta analysis'] },
  TRJ: { type: 'TRJ', title: 'Trading Journal', description: 'Trading journal and analytics workspace.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['trading journal'] },
  MRB: { type: 'MRB', title: 'Market Report Builder', description: 'Block-based market report authoring.', category: 'Research', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market report builder'] },
  MWG: { type: 'MWG', title: 'Market Widgets', description: 'Fullscreen market-widget viewer.', category: 'Tools', w: 6, h: 12, minW: 4, minH: 7, keywords: ['market widgets'] },
  PMK: { type: 'PMK', title: 'Prediction Market', description: 'Event-probability research dashboard.', category: 'Research', w: 6, h: 12, minW: 4, minH: 7, keywords: ['prediction market'] },
  STA: { type: 'STA', title: 'Statistical Analysis', description: 'Historical statistical analysis workspace.', category: 'Analytics', w: 6, h: 12, minW: 4, minH: 7, keywords: ['statistical analysis'] },
  WEM: { type: 'WEM', title: 'Weekend Market', description: 'Weekend cross-asset monitor.', category: 'Markets', w: 6, h: 12, minW: 4, minH: 7, keywords: ['weekend market'] },
};

export const PANEL_ORDER: PanelType[] = ['PLS', 'OVR', 'CHT', 'WL', 'NWS', 'USA', 'GLO', 'IDX', 'FX', 'SBN', 'FND', 'YC', 'BND', 'MAC', 'CRY', 'BOOK', 'COR', 'SEA', 'SCR', 'HUB', 'ASK', 'CAL', 'CLK', 'HELP', 'CFD', 'EFS', 'EQP', 'IAF', 'IFF', 'IOW', 'ISS', 'IPP', 'IVP', 'BRD', 'STK', 'ROT', 'ETD', 'ETF', 'ETP', 'ETS', 'DFS', 'FCA', 'FXS', 'FXP', 'FIP', 'GYC', 'URP', 'URY', 'CDS', 'CMS', 'CRR', 'AGW', 'CMD', 'OIL', 'GLF', 'GIS', 'CLS', 'CNT', 'CWT', 'CPR', 'LQM', 'FTS', 'VOL', 'OPT', 'ARR', 'MCS', 'MFL', 'MRL', 'COT', 'CTA', 'DMI', 'OFL', 'LST', 'CBD', 'EGW', 'EMP', 'FNL', 'FIS', 'INF', 'MCY', 'MGA', 'MGR', 'REC', 'GPI', 'GTM', 'POR', 'STR', 'ANR', 'ECO', 'INR', 'MRA', 'MOR', 'NSM', 'SES', 'GRM', 'NEW', 'CNW', 'ART', 'CHC', 'CPS', 'CPM', 'LVC', 'MST', 'MRV', 'SAR', 'TIN', 'TRM', 'BTL', 'FCS', 'SDS', 'PTM', 'PTS', 'RBA', 'RBA2', 'TRJ', 'MRB', 'MWG', 'PMK', 'STA', 'WEM'];

export const CATEGORIES: Category[] = ['Markets', 'Indonesia', 'Macro', 'Crypto', 'Analytics', 'Tools'];
