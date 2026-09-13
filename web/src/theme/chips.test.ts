import { describe, expect, it } from 'vitest';
import { CHIP_DENOMS, denominationBreakdown } from './chips.js';

describe('chip denomination breakdown', () => {
  it('uses generic denoms, not a protocol table', () => {
    expect(CHIP_DENOMS).toEqual([100, 25, 10, 5, 1]);
  });

  it('breaks any integer the same way for stack or pot', () => {
    expect(denominationBreakdown(0)).toEqual([]);
    expect(denominationBreakdown(-3)).toEqual([]);
    expect(denominationBreakdown(7)).toEqual([
      { value: 5, count: 1 },
      { value: 1, count: 2 },
    ]);
    expect(denominationBreakdown(40)).toEqual([
      { value: 25, count: 1 },
      { value: 10, count: 1 },
      { value: 5, count: 1 },
    ]);
    expect(denominationBreakdown(137)).toEqual([
      { value: 100, count: 1 },
      { value: 25, count: 1 },
      { value: 10, count: 1 },
      { value: 1, count: 2 },
    ]);
  });
});
