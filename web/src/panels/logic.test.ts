import { describe, expect, it } from 'vitest';
import { tzOffsetMinutes } from './indonesia';
import { idxTick } from './tools';

describe('market hours', () => {
  it('computes time-zone offsets including DST', () => {
    const jan = new Date(Date.UTC(2026, 0, 15, 12));
    const jul = new Date(Date.UTC(2026, 6, 15, 12));
    expect(tzOffsetMinutes('Asia/Jakarta', jan)).toBe(420);
    expect(tzOffsetMinutes('Asia/Makassar', jan)).toBe(480);
    expect(tzOffsetMinutes('America/New_York', jan)).toBe(-300);
    expect(tzOffsetMinutes('America/New_York', jul)).toBe(-240);
    expect(tzOffsetMinutes('Europe/London', jul)).toBe(60);
  });
});

describe('IDX tick sizes', () => {
  it('follows the price bands', () => {
    expect(idxTick(150)).toBe(1);
    expect(idxTick(454)).toBe(2);
    expect(idxTick(1340)).toBe(5);
    expect(idxTick(3270)).toBe(10);
    expect(idxTick(6325)).toBe(25);
  });
});
