import { ALL_INSTRUMENTS, resolveInstrument } from '@shared/instruments';
import { PANELS, PANEL_ORDER, type PanelType } from './panels';
import { SECTORS } from './sectors';
import type { Params } from './store';

/**
 * ASK KUARTAL — the terminal's assistant.
 *
 * Today it runs a free, instant, offline rule-based provider that turns plain
 * language ("show me bank stocks", "compare rupiah and gold", "berita batubara")
 * into terminal actions. The `AssistantProvider` interface is the seam where a
 * real model (self-hosted on the Kuartal AI server) plugs in later — the UI
 * already handles `Reply` objects, so swapping is a provider change only.
 * See docs/AI.md.
 */

export type Action =
  | { kind: 'open'; type: PanelType; params?: Params; reuse?: boolean }
  | { kind: 'focus'; symbol: string }
  | { kind: 'watch'; symbol: string }
  | { kind: 'workspace'; preset: 'desk' | 'indonesia' | 'macro' | 'crypto' | 'blank' }
  | { kind: 'theme'; theme: 'dark' | 'light' };

export interface Reply {
  text: string;
  actions: Action[];
  /** Follow-up prompts shown as chips. */
  suggestions?: string[];
}

export interface AssistantContext {
  focusSymbol: string;
  openPanels: PanelType[];
}

export interface AssistantProvider {
  id: string;
  label: string;
  ask(text: string, ctx: AssistantContext): Promise<Reply>;
}

// ───────────── Command bar: exact mnemonics ─────────────

/** Single words that open a panel instead of being read as a ticker. */
const PANEL_ALIASES: Record<string, PanelType> = {
  NEWS: 'NWS', BERITA: 'NWS', PULSE: 'PLS', CHART: 'CHT', WATCHLIST: 'WL', WATCH: 'WL', CRYPTO: 'CRY', KRIPTO: 'CRY',
  MACRO: 'MAC', MAKRO: 'MAC', YIELD: 'YC', YIELDS: 'YC', CALC: 'CAL', CALCULATOR: 'CAL', CLOCK: 'CLK', HOURS: 'CLK',
  OVERVIEW: 'OVR', MARKETS: 'OVR', FOREX: 'FX', KURS: 'FX', LQ45: 'IDX', SAHAM: 'IDX', GUIDE: 'HELP', AI: 'ASK',
  CORRELATION: 'COR', SEASONALITY: 'SEA', BOOK: 'BOOK', DEPTH: 'BOOK',
  USA: 'USA', US: 'USA', AMERICA: 'USA', BONDS: 'BND', BOND: 'BND', TREASURIES: 'BND', RATES: 'BND',
  SBN: 'SBN', SUN: 'SBN', SBSN: 'SBN', REKSADANA: 'FND', 'REKSA DANA': 'FND', FUNDS: 'FND', 'FIXED INCOME': 'FND',
  SCREENER: 'SCR', SCAN: 'SCR', SCANNER: 'SCR', ASSETS: 'HUB', 'ASSET CLASSES': 'HUB', HUB: 'HUB',
};

const KNOWN = new Set(ALL_INSTRUMENTS.flatMap((i) => [i.label.toUpperCase(), i.symbol.toUpperCase()]));

/**
 * Bloomberg-style commands. Returns null if the input isn't a command
 * (then it's handed to the assistant as natural language).
 *   BBCA            → chart BBCA
 *   BBCA GP | CHT   → chart
 *   BBCA SEA        → seasonality
 *   BTC BOOK        → order book
 *   NWS [query]     → news (optionally searched)
 *   PLS | YC | ...  → open that panel
 *   WATCH BBCA      → toggle watchlist
 *   WS INDONESIA    → open preset workspace
 *   THEME LIGHT
 */
export function parseCommand(raw: string): Reply | null {
  const input = raw.trim();
  if (!input) return null;
  const parts = input.split(/\s+/);
  const head = parts[0].toUpperCase();
  const rest = parts.slice(1).join(' ');

  const panelCode = parts.length === 1 ? (head in PANELS ? (head as PanelType) : PANEL_ALIASES[head]) : undefined;
  if (panelCode) {
    return { text: `Opened ${PANELS[panelCode].title}.`, actions: [{ kind: 'open', type: panelCode, reuse: true }] };
  }
  if ((head === 'NWS' || head === 'NEWS' || head === 'BERITA') && rest) {
    const q = rest.replace(/^(about|on|for|regarding|tentang|soal|mengenai)\s+/i, '').replace(/[?.!]+$/, '').trim();
    return { text: `Searching headlines for “${q}”.`, actions: [{ kind: 'open', type: 'NWS', params: { q }, reuse: true }] };
  }
  if ((head === 'WATCH' || head === 'WL+' || head === 'WL') && rest) {
    const inst = resolveInstrument(rest);
    if (inst) return { text: `Toggled ${inst.label} on your watchlist.`, actions: [{ kind: 'watch', symbol: inst.symbol }] };
  }
  if (head === 'WS' && rest) {
    const map: Record<string, 'desk' | 'indonesia' | 'macro' | 'crypto' | 'blank'> = { DESK: 'desk', INDONESIA: 'indonesia', ID: 'indonesia', MACRO: 'macro', CRYPTO: 'crypto', NEW: 'blank', BLANK: 'blank' };
    const p = map[rest.toUpperCase()];
    if (p) return { text: `Opened the ${rest} workspace.`, actions: [{ kind: 'workspace', preset: p }] };
  }
  if (head === 'THEME' && /^(light|dark)$/i.test(rest)) {
    return { text: `Switched to ${rest.toLowerCase()} theme.`, actions: [{ kind: 'theme', theme: rest.toLowerCase() as 'light' | 'dark' }] };
  }

  // SYMBOL [FUNCTION]
  const fn = parts.length === 2 ? parts[1].toUpperCase() : parts.length === 1 ? 'GP' : '';
  const looksLikeSymbol = KNOWN.has(head) || /^[A-Z]{4}$/.test(head) || /^[\^A-Z0-9=.\-]{1,12}$/.test(head);
  if (fn && looksLikeSymbol && (parts.length === 2 || KNOWN.has(head) || /^[A-Z]{4}$/.test(head))) {
    const inst = resolveInstrument(head);
    if (!inst) return null;
    const sym = inst.symbol;
    switch (fn) {
      case 'GP':
      case 'CHT':
      case 'CHART':
        return { text: `Charting ${inst.label}.`, actions: [{ kind: 'focus', symbol: sym }, { kind: 'open', type: 'CHT', params: { symbol: sym }, reuse: true }] };
      case 'SEA':
        return { text: `Seasonality for ${inst.label}.`, actions: [{ kind: 'open', type: 'SEA', params: { symbol: sym }, reuse: true }] };
      case 'BOOK':
      case 'OB':
        return { text: `Order book for ${inst.label}.`, actions: [{ kind: 'open', type: 'BOOK', params: { symbol: /USDT$/.test(sym) ? sym : `${inst.label}USDT` }, reuse: true }] };
      case 'NWS':
      case 'NEWS':
        return { text: `Headlines mentioning ${inst.label}.`, actions: [{ kind: 'open', type: 'NWS', params: { q: inst.label }, reuse: true }] };
      case 'WATCH':
        return { text: `Toggled ${inst.label} on your watchlist.`, actions: [{ kind: 'watch', symbol: sym }] };
    }
  }
  return null;
}

// ───────────── Natural language (rule-based provider) ─────────────

const INDICATOR_WORDS: [RegExp, string][] = [
  [/inflation|inflasi|cpi|prices?/, 'FP.CPI.TOTL.ZG'],
  [/gdp per capita|income per/, 'NY.GDP.PCAP.CD'],
  [/gdp|growth|pertumbuhan|economy grow/, 'NY.GDP.MKTP.KD.ZG'],
  [/unemploy|pengangguran|jobs|labou?r/, 'SL.UEM.TOTL.ZS'],
  [/fdi|foreign direct|investasi asing|investment inflow/, 'BX.KLT.DINV.WD.GD.ZS'],
  [/current account|neraca/, 'BN.CAB.XOKA.GD.ZS'],
  [/debt|utang/, 'GC.DOD.TOTL.GD.ZS'],
  [/export|ekspor/, 'NE.EXP.GNFS.ZS'],
  [/lending|interest rate|suku bunga/, 'FR.INR.LEND'],
];

const COUNTRY_WORDS: [RegExp, string][] = [
  [/indonesia|\bri\b|\bindo\b/, 'IDN'], [/malaysia/, 'MYS'], [/thailand/, 'THA'], [/philippines|filipina/, 'PHL'], [/vietnam/, 'VNM'],
  [/singapore|singapura/, 'SGP'], [/india\b/, 'IND'], [/china|tiongkok/, 'CHN'], [/japan|jepang/, 'JPN'], [/korea/, 'KOR'],
  [/australia/, 'AUS'], [/\bus\b|usa|united states|america|amerika/, 'USA'], [/\buk\b|britain|united kingdom|inggris/, 'GBR'],
  [/germany|jerman/, 'DEU'], [/brazil/, 'BRA'], [/saudi/, 'SAU'], [/uae|emirates/, 'ARE'], [/turkey|turkiye/, 'TUR'],
];

const WORD_SYMBOLS: [RegExp, string][] = [
  [/rupiah|\bidr\b|kurs/, 'IDR=X'], [/\bgold\b|\bemas\b|xau/, 'GC=F'], [/silver|perak/, 'SI=F'], [/\bbrent\b|\boil\b|minyak|crude/, 'BZ=F'],
  [/\bcoal\b|batubara/, 'MTF=F'], [/copper|tembaga/, 'HG=F'], [/bitcoin|\bbtc\b/, 'BTCUSDT'], [/ethereum|\beth\b/, 'ETHUSDT'],
  [/\bihsg\b|\bjci\b|jakarta composite|composite/, '^JKSE'], [/s&p|sp500|s and p|\bspx\b/, '^GSPC'], [/nasdaq/, '^IXIC'], [/\bdow\b/, '^DJI'],
  [/\bvix\b|volatility/, '^VIX'], [/dollar index|\bdxy\b/, 'DX-Y.NYB'], [/10.?year|10y|treasur/, '^TNX'], [/nikkei/, '^N225'], [/hang seng/, '^HSI'],
];

function findSymbols(text: string): string[] {
  const out: string[] = [];
  const lower = ` ${text.toLowerCase()} `;
  for (const [re, sym] of WORD_SYMBOLS) if (re.test(lower)) out.push(sym);
  for (const tok of text.split(/[^A-Za-z0-9^=.]+/)) {
    const up = tok.toUpperCase();
    if (up.length >= 3 && KNOWN.has(up)) {
      const inst = resolveInstrument(up);
      if (inst) out.push(inst.symbol);
    }
  }
  return [...new Set(out)];
}

export function ruleBasedAnswer(text: string, ctx: AssistantContext): Reply {
  const t = text.toLowerCase().trim();
  const cmd = parseCommand(text);
  if (cmd) return cmd;

  if (!t || /^(hi|hello|halo|hai|help|bantuan)\b|^what can you do|^\?+$/.test(t)) {
    return {
      text: 'I can open and arrange panels for you. Try asking in plain English or Bahasa — I\'ll set up the terminal. I don\'t give buy/sell advice.',
      actions: [],
      suggestions: ['How risky is the market today?', 'Show me bank stocks', 'Compare rupiah, gold and IHSG', 'Inflation in ASEAN', 'Berita batubara', 'Chart BBRI'],
    };
  }

  const symbols = findSymbols(text);
  const actions: Action[] = [];
  const said: string[] = [];

  // Light/dark
  if (/light mode|light theme|mode terang/.test(t)) return { text: 'Switched to light theme.', actions: [{ kind: 'theme', theme: 'light' }] };
  if (/dark mode|dark theme|mode gelap/.test(t)) return { text: 'Switched to dark theme.', actions: [{ kind: 'theme', theme: 'dark' }] };

  // Risk / mood questions → Pulse
  if (/risk|mood|sentiment|regime|pulse|safe|how.*market|market.*today|kondisi pasar/.test(t) && !/correlat/.test(t)) {
    actions.push({ kind: 'open', type: 'PLS', reuse: true });
    said.push('Kuartal Pulse scores global risk appetite and the Indonesia lens, with the reasons behind the score');
  }

  // News
  const newsMatch = t.match(/(?:news|berita|headlines?)\s+(?:about|on|for|tentang|soal)?\s*(.+)$/);
  if (newsMatch || /\bnews\b|berita|headline/.test(t)) {
    const q = newsMatch?.[1]?.replace(/[?.!]+$/, '').trim();
    const region = /indonesia|lokal|local|idx|rupiah/.test(t) ? 'id' : undefined;
    actions.push({ kind: 'open', type: 'NWS', params: { q: q && q.length < 40 ? q : undefined, region }, reuse: true });
    said.push(q ? `headlines matching “${q}”` : 'the news feed');
  }

  // Sector baskets → IDX panel filtered
  for (const [key, s] of Object.entries(SECTORS)) {
    if (s.words.some((w) => new RegExp(`\\b${w}\\b`).test(t)) && /stock|saham|shares|sector|sektor|idx|names|companies|emiten|show/.test(t)) {
      actions.push({ kind: 'open', type: 'IDX', params: { group: key, view: 'table' }, reuse: true });
      said.push(`IDX ${s.label.toLowerCase()} names`);
      break;
    }
  }

  // Macro
  const indicator = INDICATOR_WORDS.find(([re]) => re.test(t))?.[1];
  const countries = COUNTRY_WORDS.filter(([re]) => re.test(t)).map(([, c]) => c);
  if (indicator && (countries.length || /asean|countries|negara|compare|macro|makro|economy|ekonomi/.test(t))) {
    const list = countries.length ? countries : /asean/.test(t) || !countries.length ? ['IDN', 'MYS', 'THA', 'PHL', 'VNM', 'SGP'] : countries;
    if (countries.length === 1 && countries[0] !== 'IDN') list.unshift('IDN');
    actions.push({ kind: 'open', type: 'MAC', params: { indicator, countries: [...new Set(list)].join(',') }, reuse: true });
    said.push('a World Bank macro comparison');
  } else if (/yield curve|kurva|inversion|inverted/.test(t)) {
    actions.push({ kind: 'open', type: 'YC', reuse: true });
    said.push('the US Treasury yield curve');
  }

  // Compare / correlation between named assets
  if (symbols.length >= 2 && /compare|correlat|vs\.?|versus|relationship|bandingkan|korelasi|and|dan/.test(t)) {
    actions.push({ kind: 'open', type: 'COR', params: { symbols: symbols.join(',') }, reuse: true });
    actions.push({ kind: 'focus', symbol: symbols[0] });
    said.push(`a correlation matrix of ${symbols.length} assets (Pro)`);
  } else if (symbols.length >= 1 && !actions.some((a) => a.kind === 'open' && a.type === 'NWS')) {
    const sym = symbols[0];
    if (/season|bulan|monthly/.test(t)) {
      actions.push({ kind: 'open', type: 'SEA', params: { symbol: sym }, reuse: true });
      said.push('monthly seasonality (Pro)');
    } else if (/book|depth|bids|asks/.test(t)) {
      actions.push({ kind: 'open', type: 'BOOK', params: { symbol: sym }, reuse: true });
      said.push('the live order book');
    } else {
      actions.push({ kind: 'focus', symbol: sym });
      actions.push({ kind: 'open', type: 'CHT', params: { symbol: sym }, reuse: true });
      said.push(`a chart of ${resolveInstrument(sym)?.label ?? sym}`);
    }
    if (/watch|pantau|save|simpan/.test(t)) {
      actions.push({ kind: 'watch', symbol: sym });
      said.push('your watchlist');
    }
  }

  // Generic panel keywords as last resort
  if (!actions.length) {
    for (const type of PANEL_ORDER) {
      if (PANELS[type].keywords.some((k) => t.includes(k))) {
        actions.push({ kind: 'open', type, reuse: true });
        said.push(PANELS[type].title);
        break;
      }
    }
  }

  if (/should i (buy|sell)|beli atau jual|buy or sell|will .* go up|target price/.test(t)) {
    return {
      text: 'I can\'t tell you whether to buy or sell — Kuartal Terminal is a research tool, not investment advice. I\'ve opened the data that usually helps people think it through.',
      actions: actions.length ? actions : [{ kind: 'open', type: 'PLS', reuse: true }],
    };
  }

  if (!actions.length) {
    return {
      text: 'I didn\'t catch a panel or market in that. Try naming an asset (BBCA, rupiah, gold, BTC), a topic (inflation, yield curve, news about coal) or a panel.',
      actions: [],
      suggestions: ['Show me bank stocks', 'News about rupiah', 'GDP growth Indonesia vs Vietnam', 'Chart gold'],
    };
  }
  return { text: `Opened ${said.join(', ')}.`, actions };
}

export const ruleBasedProvider: AssistantProvider = {
  id: 'rules',
  label: 'Kuartal rules (offline)',
  ask: async (text, ctx) => ruleBasedAnswer(text, ctx),
};

/**
 * Placeholder for the self-hosted model (Kuartal AI server). The server route
 * /api/ai/ask returns 501 until it's wired up; we then fall back to rules.
 */
export const remoteProvider: AssistantProvider = {
  id: 'remote',
  label: 'Kuartal AI (coming soon)',
  ask: async (text, ctx) => {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, context: ctx, panels: PANEL_ORDER }),
    });
    if (!res.ok) throw new Error(`ai ${res.status}`);
    return (await res.json()) as Reply;
  },
};

let remoteAvailable = true;

export async function askKuartal(text: string, ctx: AssistantContext): Promise<Reply> {
  if (remoteAvailable) {
    try {
      return await remoteProvider.ask(text, ctx);
    } catch {
      remoteAvailable = false; // don't retry every question this session
    }
  }
  return ruleBasedProvider.ask(text, ctx);
}
