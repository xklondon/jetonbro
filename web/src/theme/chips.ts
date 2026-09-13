/** Generic chip values. Not a protocol table — same breakdown for any integer. */
export const CHIP_DENOMS = [100, 25, 10, 5, 1] as const;

export type ChipDenom = (typeof CHIP_DENOMS)[number];

export interface ChipStack {
  value: ChipDenom;
  count: number;
}

export function denominationBreakdown(amount: number): ChipStack[] {
  let remaining = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const stacks: ChipStack[] = [];
  for (const value of CHIP_DENOMS) {
    const count = Math.floor(remaining / value);
    if (count > 0) {
      stacks.push({ value, count });
      remaining -= count * value;
    }
  }
  return stacks;
}
