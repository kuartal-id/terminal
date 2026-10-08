import type { CotRow, FundamentalsResponse, PredictionMarket } from '../../../shared/research';
import { fetchJson, UpstreamError } from '../http';

/**
 * Free official / public research feeds. All keyless.
 *  - CFTC Commitments of Traders (US government, public domain) via the CFTC
 *    Socrata open-data API — "Legacy, futures only" dataset 6dca-aqww.
 *  - SEC EDGAR XBRL "companyfacts" (US government, public domain). SEC asks
 *    for a descriptive User-Agent with a contact address and ≤10 req/s.
 *  - Polymarket Gamma API (public market data; probabilities only — we do
 *    not link to or encourage placing bets).
 */

// ───────────── CFTC COT ─────────────

export const COT_MARKETS: { code: string; market: string; group: string }[] = [
  { code: '13874A', market: 'S&P 500 E-mini', group: 'Equity' },
  { code: '209742', market: 'Nasdaq-100 E-mini', group: 'Equity' },
  { code: '043602', market: '10Y Treasury Note', group: 'Rates' },
  { code: '098662', market: 'US Dollar Index', group: 'FX' },
  { code: '099741', market: 'Euro FX', group: 'FX' },
  { code: '097741', market: 'Japanese Yen', group: 'FX' },
  { code: '096742', market: 'British Pound', group: 'FX' },
  { code: '232741', market: 'Australian Dollar', group: 'FX' },
  { code: '088691', market: 'Gold', group: 'Metals' },
  { code: '084691', market: 'Silver', group: 'Metals' },
  { code: '085692', market: 'Copper', group: 'Metals' },
  { code: '067651', market: 'WTI Crude Oil', group: 'Energy' },
  { code: '023651', market: 'Natural Gas', group: 'Energy' },
  { code: '002602', market: 'Corn', group: 'Agriculture' },
  { code: '005602', market: 'Soybeans', group: 'Agriculture' },
  { code: '001602', market: 'Wheat (SRW)', group: 'Agriculture' },
  { code: '133741', market: 'Bitcoin (CME)', group: 'Crypto' },
];

interface RawCot {
  report_date_as_yyyy_mm_dd?: string;
  cftc_contract_market_code?: string;
  open_interest_all?: string;
  noncomm_positions_long_all?: string;
  noncomm_positions_short_all?: string;
}

/** Turn raw weekly rows (any order, many markets) into one summary per market. Pure. */
export function parseCot(raw: RawCot[]): CotRow[] {
  const byCode = new Map<string, { date: string; net: number; oi: number }[]>();
  for (const r of raw) {
    const code = (r.cftc_contract_market_code ?? '').trim();
    const date = (r.report_date_as_yyyy_mm_dd ?? '').slice(0, 10);
    const long = Number(r.noncomm_positions_long_all);
    const short = Number(r.noncomm_positions_short_all);
    const oi = Number(r.open_interest_all);
    if (!code || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isFinite(long) || !isFinite(short)) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code)!.push({ date, net: long - short, oi: isFinite(oi) ? oi : 0 });
  }
  const out: CotRow[] = [];
  for (const m of COT_MARKETS) {
    const rows = (byCode.get(m.code) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) continue;
    const cur = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    const window = rows.slice(-156); // ~3 years of weekly reports
    const lo = Math.min(...window.map((r) => r.net));
    const hi = Math.max(...window.map((r) => r.net));
    out.push({
      market: m.market,
      code: m.code,
      date: cur.date,
      netSpec: cur.net,
      netSpecChange: prev ? cur.net - prev.net : 0,
      netPctOi: cur.oi ? Number(((cur.net / cur.oi) * 100).toFixed(1)) : 0,
      cotIndex: hi === lo ? 50 : Math.round(((cur.net - lo) / (hi - lo)) * 100),
      openInterest: cur.oi,
      history: window.map((r) => ({ date: r.date, net: r.net })),
    });
  }
  if (!out.length) throw new UpstreamError('CFTC: no rows for tracked markets');
  return out;
}

export async function fetchCot(): Promise<CotRow[]> {
  const since = new Date(Date.now() - 3.1 * 365 * 86400_000).toISOString().slice(0, 10);
  const codes = COT_MARKETS.map((m) => `'${m.code}'`).join(',');
  const params = new URLSearchParams({
    $select: 'report_date_as_yyyy_mm_dd,cftc_contract_market_code,open_interest_all,noncomm_positions_long_all,noncomm_positions_short_all',
    $where: `cftc_contract_market_code in(${codes}) AND report_date_as_yyyy_mm_dd >= '${since}'`,
    $order: 'report_date_as_yyyy_mm_dd DESC',
    $limit: '5000',
  });
  return parseCot(await fetchJson<RawCot[]>(`https://publicreporting.cftc.gov/resource/6dca-aqww.json?${params}`, { timeoutMs: 15_000 }));
}

// ───────────── SEC EDGAR fundamentals ─────────────

const SEC_UA = { 'User-Agent': 'Kuartal Terminal research hello@kuartal.id' };

interface RawFact {
  val: number;
  fy?: number;
  fp?: string;
  form?: string;
  frame?: string;
  end?: string;
}
interface RawFacts {
  cik?: number;
  entityName?: string;
  facts?: { 'us-gaap'?: Record<string, { units?: Record<string, RawFact[]> }> };
}

const CONCEPTS: Record<string, string[]> = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'RevenueFromContractWithCustomerIncludingAssessedTax'],
  netIncome: ['NetIncomeLoss', 'ProfitLoss'],
  operatingIncome: ['OperatingIncomeLoss'],
  eps: ['EarningsPerShareDiluted', 'EarningsPerShareBasic'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  cash: ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment'],
};
const INSTANT = new Set(['assets', 'liabilities', 'equity', 'cash']);

/**
 * Annual values by calendar-aligned frame: duration facts use frames like
 * "CY2024", balance-sheet (instant) facts use "CY2024Q4I". Frames are SEC's
 * own de-duplication, so restated comparatives don't double count. Pure.
 */
export function parseCompanyFacts(raw: RawFacts, ticker: string): FundamentalsResponse {
  const gaap = raw.facts?.['us-gaap'];
  if (!gaap || !raw.cik) throw new UpstreamError('SEC: no us-gaap facts');
  const years = new Map<number, FundamentalsResponse['annual'][number]>();
  let currency = 'USD';
  for (const [field, names] of Object.entries(CONCEPTS)) {
    for (const name of names) {
      const units = gaap[name]?.units;
      if (!units) continue;
      const unitKey = field === 'eps' ? Object.keys(units).find((u) => u.includes('/shares')) : Object.keys(units).find((u) => /^[A-Z]{3}$/.test(u));
      if (!unitKey) continue;
      if (field !== 'eps') currency = unitKey;
      const re = INSTANT.has(field) ? /^CY(\d{4})Q4I$/ : /^CY(\d{4})$/;
      let found = false;
      for (const f of units[unitKey]) {
        const m = f.frame?.match(re);
        if (!m) continue;
        const y = Number(m[1]);
        const row = years.get(y) ?? { fy: y, end: f.end ?? `${y}-12-31` };
        if ((row as Record<string, unknown>)[field] === undefined) {
          (row as Record<string, unknown>)[field] = f.val;
          if (!INSTANT.has(field)) row.end = f.end ?? row.end;
          found = true;
        }
        years.set(y, row);
      }
      if (found) break; // first concept that has data wins
    }
  }
  const annual = [...years.values()].filter((r) => r.revenue !== undefined || r.netIncome !== undefined).sort((a, b) => a.fy - b.fy).slice(-6);
  if (!annual.length) throw new UpstreamError('SEC: no annual figures');
  const cur = annual[annual.length - 1];
  const prev = annual[annual.length - 2];
  const r = (v: number | undefined | null, d = 1) => (v == null || !isFinite(v) ? null : Number(v.toFixed(d)));
  const ratios: FundamentalsResponse['ratios'] = [
    { name: 'Revenue growth', value: cur.revenue && prev?.revenue ? r((cur.revenue / prev.revenue - 1) * 100) : null, units: '%' },
    { name: 'Operating margin', value: cur.operatingIncome != null && cur.revenue ? r((cur.operatingIncome / cur.revenue) * 100) : null, units: '%' },
    { name: 'Net margin', value: cur.netIncome != null && cur.revenue ? r((cur.netIncome / cur.revenue) * 100) : null, units: '%' },
    { name: 'Return on equity', value: cur.netIncome != null && cur.equity ? r((cur.netIncome / cur.equity) * 100) : null, units: '%' },
    { name: 'Liabilities / equity', value: cur.liabilities != null && cur.equity ? r(cur.liabilities / cur.equity, 2) : null, units: '×' },
    { name: 'Free cash flow', value: cur.operatingCashFlow != null ? r((cur.operatingCashFlow - (cur.capex ?? 0)) / 1e9, 2) : null, units: `${currency} bn` },
  ];
  const cik = String(raw.cik).padStart(10, '0');
  return { ticker, name: raw.entityName ?? ticker, cik, currency, annual, ratios, filingsUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K` };
}

let tickerMap: Map<string, number> | undefined;
async function cikFor(ticker: string): Promise<number> {
  if (!tickerMap) {
    const raw = await fetchJson<Record<string, { cik_str: number; ticker: string }>>('https://www.sec.gov/files/company_tickers.json', { headers: SEC_UA, timeoutMs: 15_000 });
    tickerMap = new Map(Object.values(raw).map((r) => [r.ticker.toUpperCase(), r.cik_str]));
  }
  const cik = tickerMap.get(ticker.toUpperCase().replace('.', '-'));
  if (!cik) throw new UpstreamError(`SEC: ${ticker} is not a US SEC filer`);
  return cik;
}

export async function fetchFundamentals(ticker: string): Promise<FundamentalsResponse> {
  const cik = await cikFor(ticker);
  const raw = await fetchJson<RawFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`, { headers: SEC_UA, timeoutMs: 20_000 });
  return parseCompanyFacts(raw, ticker.toUpperCase());
}

// ───────────── Polymarket ─────────────

interface RawPm {
  id?: string | number;
  question?: string;
  category?: string;
  endDate?: string;
  volumeNum?: number;
  volume?: string | number;
  liquidityNum?: number;
  outcomes?: string | string[];
  outcomePrices?: string | string[];
  slug?: string;
  events?: { slug?: string; title?: string }[];
  active?: boolean;
  closed?: boolean;
}

const asArray = (v: string | string[] | undefined): string[] => {
  if (Array.isArray(v)) return v.map(String);
  try {
    const p = JSON.parse(v ?? '[]');
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
};

/** Pure. Drops closed markets and ones without usable prices. */
export function parsePolymarket(raw: RawPm[]): PredictionMarket[] {
  return raw
    .filter((m) => m.question && m.active !== false && m.closed !== true)
    .map((m) => {
      const names = asArray(m.outcomes);
      const prices = asArray(m.outcomePrices).map(Number);
      return {
        id: String(m.id ?? m.slug ?? m.question),
        question: m.question!,
        category: m.category ?? m.events?.[0]?.title ?? null,
        endDate: m.endDate ?? null,
        volume: Number(m.volumeNum ?? m.volume ?? 0) || 0,
        liquidity: Number(m.liquidityNum ?? 0) || 0,
        outcomes: names.map((name, i) => ({ name, probability: Number(((prices[i] ?? NaN) * 100).toFixed(1)) })).filter((o) => isFinite(o.probability)),
        url: `https://polymarket.com/event/${m.events?.[0]?.slug ?? m.slug ?? ''}`,
      };
    })
    .filter((m) => m.outcomes.length >= 2);
}

export const PM_TOPICS: Record<string, string> = {
  economy: 'Economy',
  'fed-rates': 'Fed rates',
  geopolitics: 'Geopolitics',
  crypto: 'Crypto',
  politics: 'Politics',
};

interface RawPmEvent {
  slug?: string;
  title?: string;
  markets?: RawPm[];
}

/** Flatten Gamma events (each with nested markets) into markets carrying the event slug + topic. Pure. */
export function parsePolymarketEvents(events: RawPmEvent[], topic: string): PredictionMarket[] {
  const markets = events.flatMap((e) => (e.markets ?? []).map((m) => ({ ...m, category: topic, events: [{ slug: e.slug, title: e.title }] })));
  return parsePolymarket(markets);
}

export async function fetchPredictionMarkets(topic: string): Promise<PredictionMarket[]> {
  if (!(topic in PM_TOPICS)) throw new UpstreamError('unknown topic');
  const url = `https://gamma-api.polymarket.com/events?tag_slug=${encodeURIComponent(topic)}&active=true&closed=false&order=volume24hr&ascending=false&limit=25`;
  const out = parsePolymarketEvents(await fetchJson<RawPmEvent[]>(url, { timeoutMs: 12_000 }), PM_TOPICS[topic]);
  if (!out.length) throw new UpstreamError('Polymarket: no active markets');
  return out.sort((x, y) => y.volume - x.volume).slice(0, 40);
}
