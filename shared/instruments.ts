import type { Instrument } from './types';

/**
 * The instrument universe the terminal knows by name.
 * Symbols are Yahoo-style except crypto, which uses Binance pairs.
 * Anything not listed here can still be loaded by raw symbol (e.g. "TLKM.JK").
 */

const idx = (code: string, name: string): Instrument => ({
  symbol: `${code}.JK`,
  label: code,
  name,
  assetClass: 'equity',
  group: 'LQ45',
  currency: 'IDR',
});

/**
 * LQ45 constituents. IDX rebalances this list every February and August —
 * update it from https://www.idx.co.id when it changes. Nothing breaks if a
 * name is stale; it just stops being "LQ45".
 */
export const LQ45: Instrument[] = [
  idx('AADI', 'Adaro Andalan Indonesia'),
  idx('ACES', 'Aspirasi Hidup Indonesia'),
  idx('ADMR', 'Adaro Minerals Indonesia'),
  idx('ADRO', 'AlamTri Resources Indonesia'),
  idx('AKRA', 'AKR Corporindo'),
  idx('AMMN', 'Amman Mineral Internasional'),
  idx('AMRT', 'Sumber Alfaria Trijaya'),
  idx('ANTM', 'Aneka Tambang'),
  idx('ARTO', 'Bank Jago'),
  idx('ASII', 'Astra International'),
  idx('BBCA', 'Bank Central Asia'),
  idx('BBNI', 'Bank Negara Indonesia'),
  idx('BBRI', 'Bank Rakyat Indonesia'),
  idx('BBTN', 'Bank Tabungan Negara'),
  idx('BMRI', 'Bank Mandiri'),
  idx('BRIS', 'Bank Syariah Indonesia'),
  idx('BRPT', 'Barito Pacific'),
  idx('CPIN', 'Charoen Pokphand Indonesia'),
  idx('CTRA', 'Ciputra Development'),
  idx('ESSA', 'ESSA Industries Indonesia'),
  idx('EXCL', 'XLSmart Telecom Sejahtera'),
  idx('GOTO', 'GoTo Gojek Tokopedia'),
  idx('ICBP', 'Indofood CBP Sukses Makmur'),
  idx('INCO', 'Vale Indonesia'),
  idx('INDF', 'Indofood Sukses Makmur'),
  idx('INKP', 'Indah Kiat Pulp & Paper'),
  idx('ISAT', 'Indosat Ooredoo Hutchison'),
  idx('ITMG', 'Indo Tambangraya Megah'),
  idx('JPFA', 'Japfa Comfeed Indonesia'),
  idx('JSMR', 'Jasa Marga'),
  idx('KLBF', 'Kalbe Farma'),
  idx('MAPA', 'Map Aktif Adiperkasa'),
  idx('MAPI', 'Mitra Adiperkasa'),
  idx('MBMA', 'Merdeka Battery Materials'),
  idx('MDKA', 'Merdeka Copper Gold'),
  idx('MEDC', 'Medco Energi Internasional'),
  idx('PGAS', 'Perusahaan Gas Negara'),
  idx('PGEO', 'Pertamina Geothermal Energy'),
  idx('PTBA', 'Bukit Asam'),
  idx('SIDO', 'Industri Jamu Sido Muncul'),
  idx('SMGR', 'Semen Indonesia'),
  idx('SMRA', 'Summarecon Agung'),
  idx('TLKM', 'Telkom Indonesia'),
  idx('TOWR', 'Sarana Menara Nusantara'),
  idx('UNTR', 'United Tractors'),
  idx('UNVR', 'Unilever Indonesia'),
];

export const MARKETS: Instrument[] = [
  // Indonesia
  { symbol: '^JKSE', label: 'IHSG', name: 'Jakarta Composite Index', assetClass: 'index', group: 'Indonesia', currency: 'IDR' },
  { symbol: '^JKLQ45', label: 'LQ45', name: 'LQ45 Index', assetClass: 'index', group: 'Indonesia', currency: 'IDR' },
  { symbol: 'IDR=X', label: 'USD/IDR', name: 'US Dollar / Rupiah', assetClass: 'fx', group: 'Indonesia', currency: 'IDR' },
  { symbol: 'EIDO', label: 'EIDO', name: 'iShares MSCI Indonesia ETF (US-listed)', assetClass: 'etf', group: 'Indonesia', currency: 'USD' },
  // Asia
  { symbol: '^N225', label: 'NIKKEI', name: 'Nikkei 225', assetClass: 'index', group: 'Asia', currency: 'JPY' },
  { symbol: '^HSI', label: 'HSI', name: 'Hang Seng Index', assetClass: 'index', group: 'Asia', currency: 'HKD' },
  { symbol: '000001.SS', label: 'SHCOMP', name: 'Shanghai Composite', assetClass: 'index', group: 'Asia', currency: 'CNY' },
  { symbol: '^STI', label: 'STI', name: 'Straits Times Index', assetClass: 'index', group: 'Asia', currency: 'SGD' },
  { symbol: '^KLSE', label: 'KLCI', name: 'FTSE Bursa Malaysia KLCI', assetClass: 'index', group: 'Asia', currency: 'MYR' },
  { symbol: '^SET.BK', label: 'SET', name: 'SET Index (Thailand)', assetClass: 'index', group: 'Asia', currency: 'THB' },
  { symbol: 'PSEI.PS', label: 'PSEI', name: 'PSE Composite (Philippines)', assetClass: 'index', group: 'Asia', currency: 'PHP' },
  { symbol: '^KS11', label: 'KOSPI', name: 'KOSPI Composite', assetClass: 'index', group: 'Asia', currency: 'KRW' },
  { symbol: '^AXJO', label: 'ASX200', name: 'S&P/ASX 200', assetClass: 'index', group: 'Asia', currency: 'AUD' },
  // US & Europe
  { symbol: '^GSPC', label: 'SPX', name: 'S&P 500', assetClass: 'index', group: 'US & Europe', currency: 'USD' },
  { symbol: '^IXIC', label: 'NASDAQ', name: 'Nasdaq Composite', assetClass: 'index', group: 'US & Europe', currency: 'USD' },
  { symbol: '^DJI', label: 'DOW', name: 'Dow Jones Industrial Average', assetClass: 'index', group: 'US & Europe', currency: 'USD' },
  { symbol: '^RUT', label: 'RUSSELL', name: 'Russell 2000', assetClass: 'index', group: 'US & Europe', currency: 'USD' },
  { symbol: '^VIX', label: 'VIX', name: 'CBOE Volatility Index', assetClass: 'index', group: 'US & Europe', unit: 'pts' },
  { symbol: '^FTSE', label: 'FTSE', name: 'FTSE 100', assetClass: 'index', group: 'US & Europe', currency: 'GBP' },
  { symbol: '^GDAXI', label: 'DAX', name: 'DAX 40', assetClass: 'index', group: 'US & Europe', currency: 'EUR' },
  { symbol: '^STOXX50E', label: 'STOXX50', name: 'Euro Stoxx 50', assetClass: 'index', group: 'US & Europe', currency: 'EUR' },
  // FX
  { symbol: 'DX-Y.NYB', label: 'DXY', name: 'US Dollar Index', assetClass: 'fx', group: 'FX' },
  { symbol: 'EURUSD=X', label: 'EUR/USD', name: 'Euro / US Dollar', assetClass: 'fx', group: 'FX' },
  { symbol: 'JPY=X', label: 'USD/JPY', name: 'US Dollar / Yen', assetClass: 'fx', group: 'FX' },
  { symbol: 'CNY=X', label: 'USD/CNY', name: 'US Dollar / Yuan', assetClass: 'fx', group: 'FX' },
  { symbol: 'SGD=X', label: 'USD/SGD', name: 'US Dollar / Singapore Dollar', assetClass: 'fx', group: 'FX' },
  { symbol: 'AUDUSD=X', label: 'AUD/USD', name: 'Australian Dollar / US Dollar', assetClass: 'fx', group: 'FX' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', name: 'Pound / US Dollar', assetClass: 'fx', group: 'FX' },
  // Commodities
  { symbol: 'GC=F', label: 'GOLD', name: 'Gold Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'SI=F', label: 'SILVER', name: 'Silver Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'BZ=F', label: 'BRENT', name: 'Brent Crude Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'CL=F', label: 'WTI', name: 'WTI Crude Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'NG=F', label: 'NATGAS', name: 'Henry Hub Natural Gas', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'HG=F', label: 'COPPER', name: 'Copper Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  { symbol: 'MTF=F', label: 'COAL', name: 'Coal (API2 Rotterdam) Futures', assetClass: 'commodity', group: 'Commodities', currency: 'USD' },
  // Rates
  { symbol: '^IRX', label: 'UST 3M', name: 'US Treasury 13-Week Bill', assetClass: 'rate', group: 'Rates', unit: '%' },
  { symbol: '^FVX', label: 'UST 5Y', name: 'US Treasury 5-Year', assetClass: 'rate', group: 'Rates', unit: '%' },
  { symbol: '^TNX', label: 'UST 10Y', name: 'US Treasury 10-Year', assetClass: 'rate', group: 'Rates', unit: '%' },
  { symbol: '^TYX', label: 'UST 30Y', name: 'US Treasury 30-Year', assetClass: 'rate', group: 'Rates', unit: '%' },
  // Crypto (Binance pairs, live via websocket in the browser)
  { symbol: 'BTCUSDT', label: 'BTC', name: 'Bitcoin', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
  { symbol: 'ETHUSDT', label: 'ETH', name: 'Ethereum', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
  { symbol: 'SOLUSDT', label: 'SOL', name: 'Solana', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
  { symbol: 'BNBUSDT', label: 'BNB', name: 'BNB', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
  { symbol: 'XRPUSDT', label: 'XRP', name: 'XRP', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
  { symbol: 'PAXGUSDT', label: 'PAXG', name: 'PAX Gold (tokenised gold)', assetClass: 'crypto', group: 'Crypto', currency: 'USDT' },
];

const US_EQUITIES: Instrument[] = [
  ['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','NVIDIA'],['AMZN','Amazon'],['META','Meta Platforms'],['GOOGL','Alphabet'],['TSLA','Tesla'],
  ['AVGO','Broadcom'],['JPM','JPMorgan Chase'],['BRK-B','Berkshire Hathaway'],['XOM','Exxon Mobil'],['UNH','UnitedHealth'],['V','Visa'],['MA','Mastercard'],
  ['LLY','Eli Lilly'],['COST','Costco'],['WMT','Walmart'],['JNJ','Johnson & Johnson'],['PG','Procter & Gamble'],['HD','Home Depot'],
  ['NFLX','Netflix'],['ORCL','Oracle'],['CRM','Salesforce'],['AMD','AMD'],['QCOM','Qualcomm'],['BAC','Bank of America'],['GS','Goldman Sachs'],
  ['CAT','Caterpillar'],['GE','GE Aerospace'],['KO','Coca-Cola'],
].map(([symbol, name]) => ({ symbol, label: symbol, name, assetClass: 'equity' as const, group: 'US Equities', currency: 'USD' }));

const US_ETFS: Instrument[] = [
  ['SPY','SPDR S&P 500 ETF'],['QQQ','Invesco QQQ'],['IWM','iShares Russell 2000'],['DIA','SPDR Dow Jones Industrial Average ETF'],
  ['TLT','iShares 20+ Year Treasury Bond ETF'],['IEF','iShares 7-10 Year Treasury Bond ETF'],['SHY','iShares 1-3 Year Treasury Bond ETF'],
  ['LQD','iShares Investment Grade Corporate Bond ETF'],['HYG','iShares High Yield Corporate Bond ETF'],['TIP','iShares TIPS Bond ETF'],['AGG','iShares Core U.S. Aggregate Bond ETF'],
].map(([symbol, name]) => ({ symbol, label: symbol, name, assetClass: 'etf' as const, group: 'US ETFs & Bonds', currency: 'USD' }));

export const ALL_INSTRUMENTS: Instrument[] = [...MARKETS, ...LQ45, ...US_EQUITIES, ...US_ETFS];

const byKey = new Map<string, Instrument>();
for (const i of ALL_INSTRUMENTS) {
  byKey.set(i.symbol.toUpperCase(), i);
  byKey.set(i.label.toUpperCase(), i);
}
// Friendly aliases people actually type.
const aliases: Record<string, string> = {
  JCI: '^JKSE', COMPOSITE: '^JKSE', RUPIAH: 'IDR=X', IDR: 'IDR=X', USDIDR: 'IDR=X', SP500: '^GSPC', 'S&P': '^GSPC',
  SPY: '^GSPC', NDX: '^IXIC', XAU: 'GC=F', XAUUSD: 'GC=F', EMAS: 'GC=F', OIL: 'BZ=F', MINYAK: 'BZ=F', BATUBARA: 'MTF=F',
  BITCOIN: 'BTCUSDT', ETHEREUM: 'ETHUSDT', US10Y: '^TNX', TNX: '^TNX', DOLLAR: 'DX-Y.NYB',
};
for (const [k, v] of Object.entries(aliases)) {
  const inst = byKey.get(v);
  if (inst) byKey.set(k, inst);
}

/** Resolve whatever the user typed ("bbca", "IHSG", "^JKSE", "BTC") to an instrument. */
export function resolveInstrument(input: string): Instrument | undefined {
  const key = input.trim().toUpperCase();
  if (!key) return undefined;
  const hit = byKey.get(key);
  if (hit) return hit;
  // Bare 4-letter IDX code not in LQ45 → assume IDX equity.
  if (/^[A-Z]{4}$/.test(key)) {
    return { symbol: `${key}.JK`, label: key, name: key, assetClass: 'equity', group: 'IDX', currency: 'IDR' };
  }
  // Anything ending in USDT is treated as a Binance pair.
  if (/^[A-Z0-9]{2,10}USDT$/.test(key)) {
    return { symbol: key, label: key.replace(/USDT$/, ''), name: key, assetClass: 'crypto', group: 'Crypto', currency: 'USDT' };
  }
  // Fallback: pass through as a raw provider symbol.
  return { symbol: input.trim(), label: input.trim().toUpperCase(), name: input.trim(), assetClass: 'equity', group: 'Other' };
}

export function isCrypto(symbol: string): boolean {
  return /USDT$/i.test(symbol);
}
