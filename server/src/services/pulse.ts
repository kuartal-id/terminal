import type { DataSource, Envelope, PulseComponent, PulseRegime, PulseReport } from '../../../shared/types';
import { pctChange, scale100 } from '../../../shared/math';
import { cache } from '../cache';
import { dailyCloses, worstSource } from './market';

/**
 * KUARTAL PULSE — a transparent, rules-based risk-appetite gauge.
 *
 * Unlike black-box "regime probability" scores, every input, threshold and
 * weight is listed here and shown to users in the panel's methodology note.
 * Inputs are 20-trading-day changes from free daily data.
 *
 * It is a research aid, not a trading signal (see the disclaimer in the UI).
 */

export function regimeFor(score: number): PulseRegime {
  if (score < 30) return 'Risk-Off';
  if (score < 45) return 'Cautious';
  if (score <= 55) return 'Neutral';
  if (score <= 70) return 'Constructive';
  return 'Risk-On';
}

export interface PulseInputs {
  spx20: number; // % change
  ihsg20: number;
  vix: number; // level
  dxy20: number;
  usdidr20: number;
  gold20: number;
  btc20: number;
  us10y20bp: number; // change in basis points
  coal20: number;
  brent20: number;
}

function comp(key: string, label: string, score: number, weight: number, reading: string): PulseComponent {
  return { key, label, score: Math.round(score), weight, reading };
}

const f = (n: number, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}`;

/** Pure scoring function — fully unit tested. */
export function scorePulse(i: PulseInputs): Omit<PulseReport, 'methodology'> {
  const global: PulseComponent[] = [
    comp('equity', 'Global equity momentum', scale100(i.spx20, -8, 8), 0.25, `S&P 500 ${f(i.spx20)}% over 20d`),
    comp('vol', 'Volatility', scale100(i.vix, 35, 12), 0.25, `VIX at ${i.vix.toFixed(1)}`),
    comp('dollar', 'US dollar', scale100(i.dxy20, 3, -3), 0.15, `DXY ${f(i.dxy20)}% over 20d`),
    comp('rates', 'US 10Y yield pressure', scale100(i.us10y20bp, 40, -40), 0.15, `10Y ${f(i.us10y20bp, 0)} bp over 20d`),
    comp('haven', 'Safe-haven demand', scale100(i.gold20 - i.spx20, 8, -8), 0.1, `Gold vs S&P ${f(i.gold20 - i.spx20)} pts`),
    comp('crypto', 'Speculative appetite', scale100(i.btc20, -20, 20), 0.1, `Bitcoin ${f(i.btc20)}% over 20d`),
  ];
  const indo: PulseComponent[] = [
    comp('ihsg', 'IHSG momentum', scale100(i.ihsg20, -8, 8), 0.35, `IHSG ${f(i.ihsg20)}% over 20d`),
    comp('rupiah', 'Rupiah', scale100(i.usdidr20, 3, -3), 0.3, `USD/IDR ${f(i.usdidr20)}% over 20d (lower = stronger rupiah)`),
    comp('coal', 'Coal (export proxy)', scale100(i.coal20, -15, 15), 0.15, `Coal ${f(i.coal20)}% over 20d`),
    comp('oil', 'Oil (import bill)', scale100(i.brent20, 15, -15), 0.1, `Brent ${f(i.brent20)}% over 20d`),
    comp('global', 'Global backdrop', 0, 0.1, ''),
  ];
  const wavg = (cs: PulseComponent[]) => cs.reduce((s, c) => s + c.score * c.weight, 0) / cs.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(wavg(global));
  indo[4] = comp('global', 'Global backdrop', score, 0.1, `Kuartal Pulse global score ${score}`);
  const indoScore = Math.round(wavg(indo));
  const regime = regimeFor(score);
  const indoRegime = regimeFor(indoScore);

  const sorted = [...global].sort((a, b) => b.score - a.score);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const narrative = [
    `Global risk appetite reads ${regime.toUpperCase()} (${score}/100). Strongest support: ${strongest.label.toLowerCase()} (${strongest.reading}). Biggest drag: ${weakest.label.toLowerCase()} (${weakest.reading}).`,
    `Indonesia lens reads ${indoRegime.toUpperCase()} (${indoScore}/100): ${indo[0].reading}; ${indo[1].reading}.`,
    i.usdidr20 > 1.5
      ? 'Rupiah weakness is the main local pressure point — watch Bank Indonesia commentary and foreign flows into big-cap banks.'
      : i.usdidr20 < -1.5
        ? 'A firmer rupiah is a tailwind for import-heavy sectors and for foreign appetite toward IDR assets.'
        : 'The rupiah is broadly stable, so local equity direction is being set more by global risk and commodities.',
  ];
  return { score, regime, components: global, indonesia: { score: indoScore, regime: indoRegime, components: indo }, narrative };
}

export const PULSE_METHODOLOGY =
  'Kuartal Pulse scores risk appetite from 0 (risk-off) to 100 (risk-on). Global score = weighted average of: S&P 500 20-day change (25%, −8%→0, +8%→100), VIX level (25%, 35→0, 12→100), DXY 20-day change (15%, inverted ±3%), US 10Y yield 20-day change (15%, inverted ±40bp), gold-minus-S&P performance (10%, inverted ±8pts) and Bitcoin 20-day change (10%, ±20%). Indonesia lens = IHSG 20-day change (35%), USD/IDR 20-day change (30%, inverted), coal (15%), Brent (10%, inverted — Indonesia is a net oil importer) and the global score (10%). Bands: <30 Risk-Off, 30–45 Cautious, 45–55 Neutral, 55–70 Constructive, >70 Risk-On. Research aid only — not investment advice.';

const LOOKBACK = 20;

function change20(closes: number[]): number {
  if (closes.length < LOOKBACK + 1) return 0;
  return pctChange(closes[closes.length - 1 - LOOKBACK], closes[closes.length - 1]);
}

export async function getPulse(): Promise<Envelope<PulseReport>> {
  return cache.get('pulse', 10 * 60_000, async () => {
    const syms = ['^GSPC', '^JKSE', '^VIX', 'DX-Y.NYB', 'IDR=X', 'GC=F', 'BTCUSDT', '^TNX', 'MTF=F', 'BZ=F'] as const;
    const series = await Promise.all(syms.map((s) => dailyCloses(s, '6M')));
    const by = Object.fromEntries(syms.map((s, i) => [s, series[i]]));
    const tnx = by['^TNX'].closes;
    const inputs: PulseInputs = {
      spx20: change20(by['^GSPC'].closes),
      ihsg20: change20(by['^JKSE'].closes),
      vix: by['^VIX'].closes.at(-1) ?? 20,
      dxy20: change20(by['DX-Y.NYB'].closes),
      usdidr20: change20(by['IDR=X'].closes),
      gold20: change20(by['GC=F'].closes),
      btc20: change20(by['BTCUSDT'].closes),
      us10y20bp: tnx.length > LOOKBACK ? (tnx[tnx.length - 1] - tnx[tnx.length - 1 - LOOKBACK]) * 100 : 0,
      coal20: change20(by['MTF=F'].closes),
      brent20: change20(by['BZ=F'].closes),
    };
    const source: DataSource = worstSource(series.map((s) => s.source));
    return {
      data: { ...scorePulse(inputs), methodology: PULSE_METHODOLOGY },
      source,
      provider: 'Kuartal Pulse model (inputs: Yahoo Finance, Binance)',
      asOf: new Date().toISOString(),
      note: source === 'demo' ? 'One or more inputs are DEMO data, so this score is illustrative only.' : undefined,
    };
  });
}
