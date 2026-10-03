import { describe, expect, it } from 'vitest';
import { resolveInstrument } from '@shared/instruments';
import { ema, rsi, sma } from '@shared/math';
import { parseCommand, ruleBasedAnswer } from './assistant';
import { decimalsFor, fmtChange, fmtCompact, fmtPct, fmtPrice } from './format';
import { PANELS, PANEL_ORDER } from './panels';

const ctx = { focusSymbol: '^JKSE', openPanels: [] };
const opens = (r: ReturnType<typeof ruleBasedAnswer>) => r.actions.filter((a) => a.kind === 'open').map((a) => (a.kind === 'open' ? a.type : ''));

describe('instrument resolution', () => {
  it('maps what people type to provider symbols', () => {
    expect(resolveInstrument('bbca')?.symbol).toBe('BBCA.JK');
    expect(resolveInstrument('IHSG')?.symbol).toBe('^JKSE');
    expect(resolveInstrument('rupiah')?.symbol).toBe('IDR=X');
    expect(resolveInstrument('emas')?.symbol).toBe('GC=F');
    expect(resolveInstrument('BTC')?.symbol).toBe('BTCUSDT');
    expect(resolveInstrument('PEPEUSDT')?.assetClass).toBe('crypto');
    expect(resolveInstrument('ABCD')?.symbol).toBe('ABCD.JK'); // any 4-letter code → IDX
    expect(resolveInstrument('')).toBeUndefined();
  });
});

describe('command bar mnemonics', () => {
  it('symbol alone charts it', () => {
    const r = parseCommand('BBCA')!;
    expect(r.actions).toContainEqual({ kind: 'open', type: 'CHT', params: { symbol: 'BBCA.JK' }, reuse: true });
  });
  it('symbol + function', () => {
    expect(parseCommand('gold sea')!.actions[0]).toMatchObject({ type: 'SEA', params: { symbol: 'GC=F' } });
    expect(parseCommand('BTC BOOK')!.actions[0]).toMatchObject({ type: 'BOOK', params: { symbol: 'BTCUSDT' } });
  });
  it('panel codes and aliases', () => {
    expect(parseCommand('YC')!.actions[0]).toMatchObject({ type: 'YC' });
    expect(parseCommand('news')!.actions[0]).toMatchObject({ type: 'NWS' });
    expect(parseCommand('NWS coal')!.actions[0]).toMatchObject({ type: 'NWS', params: { q: 'coal' } });
    expect(parseCommand('WS indonesia')!.actions[0]).toEqual({ kind: 'workspace', preset: 'indonesia' });
  });
  it('sentences are not commands', () => {
    expect(parseCommand('show me bank stocks')).toBeNull();
    expect(parseCommand('chart gold')).toBeNull();
  });
});

describe('Ask Kuartal (rules provider)', () => {
  it('bank stocks → IDX filtered to banks', () => {
    const r = ruleBasedAnswer('show me bank stocks', ctx);
    expect(r.actions[0]).toMatchObject({ kind: 'open', type: 'IDX', params: { group: 'banks' } });
  });
  it('compare assets → correlation with resolved symbols', () => {
    const r = ruleBasedAnswer('compare rupiah, gold and IHSG', ctx);
    const cor = r.actions.find((a) => a.kind === 'open' && a.type === 'COR');
    expect(cor).toBeTruthy();
    expect((cor as unknown as { params: { symbols: string } }).params.symbols.split(',').sort()).toEqual(['GC=F', 'IDR=X', '^JKSE'].sort());
  });
  it('macro in Bahasa', () => {
    const r = ruleBasedAnswer('inflasi asean', ctx);
    expect(r.actions[0]).toMatchObject({ type: 'MAC', params: { indicator: 'FP.CPI.TOTL.ZG' } });
  });
  it('country macro adds Indonesia as a comparison', () => {
    const r = ruleBasedAnswer('GDP growth in Vietnam', ctx);
    const p = (r.actions[0] as unknown as { params: { countries: string } }).params;
    expect(p.countries.split(',')).toEqual(expect.arrayContaining(['IDN', 'VNM']));
  });
  it('news search', () => {
    expect(ruleBasedAnswer('news about coal', ctx).actions[0]).toMatchObject({ type: 'NWS', params: { q: 'coal' } });
    expect(ruleBasedAnswer('berita batubara', ctx).actions[0]).toMatchObject({ type: 'NWS' });
  });
  it('risk question → Pulse', () => {
    expect(opens(ruleBasedAnswer('how risky is the market today?', ctx))).toContain('PLS');
  });
  it('chart by name, plus watchlist', () => {
    const r = ruleBasedAnswer('chart bitcoin and add it to my watchlist', ctx);
    expect(r.actions).toContainEqual({ kind: 'focus', symbol: 'BTCUSDT' });
    expect(r.actions).toContainEqual({ kind: 'watch', symbol: 'BTCUSDT' });
  });
  it('refuses buy/sell advice but still helps', () => {
    const r = ruleBasedAnswer('should i buy BBRI?', ctx);
    expect(r.text).toMatch(/not investment advice/);
    expect(r.actions.length).toBeGreaterThan(0);
  });
  it('greets with suggestions and never opens on gibberish', () => {
    expect(ruleBasedAnswer('hello', ctx).suggestions?.length).toBeGreaterThan(2);
    expect(ruleBasedAnswer('qwzx plorp', ctx).actions).toHaveLength(0);
  });
});

describe('formatting', () => {
  it('IDR prices have no decimals; small prices get more', () => {
    expect(fmtPrice(6325, 'IDR')).toBe('6,325');
    expect(fmtPrice(1.16123)).toBe('1.161');
    expect(fmtPrice(0.2134)).toBe('0.2134');
    expect(decimalsFor(76823)).toBe(2);
  });
  it('changes use the reference price precision', () => {
    expect(fmtChange(8, 'IDR', 17540)).toBe('+8');
    expect(fmtChange(-0.0008, undefined, 1.161)).toBe('−0.001');
  });
  it('percent and compact', () => {
    expect(fmtPct(1.234)).toBe('+1.23%');
    expect(fmtPct(-0.5)).toBe('-0.50%');
    expect(fmtCompact(1_234_000)).toBe('1.23M');
    expect(fmtCompact(297_000_000_000)).toBe('297B');
  });
});

describe('indicators', () => {
  it('sma/ema/rsi have the right warm-up and values', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(sma(v, 3).slice(0, 3)).toEqual([null, null, 2]);
    expect(ema(v, 3)[2]).toBe(2);
    expect(rsi(v, 5)[9]).toBe(100); // only gains
  });
});

describe('panel catalogue', () => {
  it('every panel in the order list exists, codes are unique and sizes sane', () => {
    expect(new Set(PANEL_ORDER).size).toBe(PANEL_ORDER.length);
    for (const t of PANEL_ORDER) {
      const m = PANELS[t];
      expect(m.type).toBe(t);
      expect(m.w).toBeGreaterThan(0);
      expect(m.w).toBeLessThanOrEqual(12);
      expect(m.keywords.length).toBeGreaterThan(0);
    }
    expect(Object.keys(PANELS).sort()).toEqual([...PANEL_ORDER].sort());
  });
});
