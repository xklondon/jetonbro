import { formatJetons, MILLIS_PER_JETON, type JetonMillis } from "../money";

export const STANDARD_CHIP_MILLIS: { millis: JetonMillis; label: string }[] = [
  { millis: 50n * MILLIS_PER_JETON, label: "50" },
  { millis: 25n * MILLIS_PER_JETON, label: "25" },
  { millis: 10n * MILLIS_PER_JETON, label: "10" },
  { millis: 5n * MILLIS_PER_JETON, label: "5" },
];

export type ChipComposition = {
  millis: JetonMillis;
  label: string;
  exact: boolean;
};

/** Greedy standard denominations, then one leftover exact token. Not tap history. */
export function chipCompositionFromMillis(amount: JetonMillis): ChipComposition[] {
  let remaining = amount;
  const chips: ChipComposition[] = [];
  if (remaining <= 0n) return chips;
  for (const denom of STANDARD_CHIP_MILLIS) {
    while (remaining >= denom.millis) {
      chips.push({ millis: denom.millis, label: denom.label, exact: false });
      remaining -= denom.millis;
    }
  }
  if (remaining > 0n) {
    chips.push({ millis: remaining, label: formatJetons(remaining), exact: true });
  }
  return chips;
}
