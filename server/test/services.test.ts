import { describe, expect, it } from 'vitest';
import { correlationFromSeries, seasonalityFromMonthly } from '../src/services/analytics';
import { regimeFor, scorePulse, type PulseInputs } from '../src/services/pulse';
import { worstSource } from '../src/services/market';
import { sanitizeReturn } from '../src/auth';
import { TtlCache } from '../src/cache';

const neutral: PulseInputs = { spx20: 0, ihsg20: 0, vix: 23.5, dxy20: 0, usdidr20: 0, gold20: 0, btc20: 0, us10y20bp: 0, coal20: 0, brent20: 0 };

describe('Kuartal Pulse', () => {
  it('scores a flat market as Neutral (~50)', () => {
    const p = scorePulse(neutral);
    expect(p.score).toBe(50);
    expect(p.regime).toBe('Neutral');
    expect(p.indonesia.score).toBe(50);
  });

  it('scores a strong rally with low vol as Risk-On', () => {
    const p = scorePulse({ ...neutral, spx20: 8, vix: 12, dxy20: -3, us10y20bp: -40, gold20: 0, btc20: 20 });
    expect(p.score).toBeGreaterThan(70);
    expect(p.regime).toBe('Risk-On');
  });

  it('scores a sell-off with high vol and strong dollar as Risk-Off', () => {
    const p = scorePulse({ ...neutral, spx20: -8, vix: 35, dxy20: 3, us10y20bp: 40, gold20: 4, btc20: -20 });
    expect(p.score).toBeLessThan(30);
    expect(p.regime).toBe('Risk-Off');
  });

  it('treats a weaker rupiah as negative for the Indonesia lens', () => {
    const weak = scorePulse({ ...neutral, usdidr20: 3 });
    const strong = scorePulse({ ...neutral, usdidr20: -3 });
    expect(weak.indonesia.score).toBeLessThan(strong.indonesia.score);
    expect(weak.narrative.join(' ')).toMatch(/Rupiah weakness/);
  });

  it('weights sum to 1 for both lenses', () => {
    const p = scorePulse(neutral);
    expect(p.components.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(p.indonesia.components.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
  });

  it('maps band edges consistently', () => {
    expect(regimeFor(29)).toBe('Risk-Off');
    expect(regimeFor(30)).toBe('Cautious');
    expect(regimeFor(45)).toBe('Neutral');
    expect(regimeFor(55)).toBe('Neutral');
    expect(regimeFor(56)).toBe('Constructive');
    expect(regimeFor(71)).toBe('Risk-On');
  });
});

describe('analytics', () => {
  const day = 86400;
  it('correlation of identical series is 1, of inverted moves is -1, aligned on common dates', () => {
    const times = Array.from({ length: 40 }, (_, i) => 1_700_000_000 + i * day);
    const a = times.map((_, i) => 100 + Math.sin(i) * 5 + i);
    const inv = a.map((v, i) => (i === 0 ? v : 2 * a[0] - v + 400));
    const m = correlationFromSeries(
      [
        { times, closes: a },
        { times, closes: a.map((v) => v * 2) },
        { times, closes: inv },
      ],
      30,
    );
    expect(m[0][1]).toBeCloseTo(1, 2);
    expect(m[0][2]).toBeLessThan(-0.9);
    expect(m[1][1]).toBe(1);
  });

  it('seasonality computes monthly % changes, averages and hit-rates', () => {
    const t = (y: number, mo: number) => Date.UTC(y, mo, 1) / 1000;
    const candles = [
      { time: t(2024, 11), close: 100 },
      { time: t(2025, 0), close: 110 }, // Jan 2025 +10%
      { time: t(2025, 1), close: 99 }, // Feb 2025 -10%
      { time: t(2025, 11), close: 100 },
      { time: t(2026, 0), close: 95 }, // Jan 2026 -5%
    ];
    const s = seasonalityFromMonthly(candles);
    expect(s.rows[0].year).toBe(2026);
    expect(s.rows.find((r) => r.year === 2025)!.months[0]).toBe(10);
    expect(s.average[0]).toBe(2.5);
    expect(s.hitRate[0]).toBe(50);
  });
});

describe('plumbing', () => {
  it('worstSource picks the least trustworthy label', () => {
    expect(worstSource(['live', 'delayed'])).toBe('delayed');
    expect(worstSource(['live', 'demo', 'eod'])).toBe('demo');
    expect(worstSource([])).toBe('live');
  });

  it('sanitizeReturn blocks open redirects', () => {
    expect(sanitizeReturn('/')).toBe('/');
    expect(sanitizeReturn('/?x=1')).toBe('/?x=1');
    expect(sanitizeReturn('//evil.com')).toBe('/');
    expect(sanitizeReturn('https://evil.com')).toBe('/');
    expect(sanitizeReturn('/\\evil.com')).toBe('/');
    expect(sanitizeReturn(undefined)).toBe('/');
  });

  it('cache de-duplicates concurrent loads and serves stale on error', async () => {
    const c = new TtlCache();
    let calls = 0;
    const loader = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };
    const [a, b] = await Promise.all([c.get('k', 1, loader), c.get('k', 1, loader)]);
    expect(a).toBe(1);
    expect(b).toBe(1);
    expect(calls).toBe(1);
    await new Promise((r) => setTimeout(r, 5));
    const stale = await c.get('k', 1, async () => {
      throw new Error('upstream down');
    });
    expect(stale).toBe(1);
  });
});
