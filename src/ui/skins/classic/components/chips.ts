import { formatJetons } from "@/domain/money";

export type VisualChip = {
  label: string;
  className: "c5" | "c10" | "c25" | "c50";
};

const DENOMS: { millis: bigint; label: string; className: VisualChip["className"] }[] = [
  { millis: 50000n, label: "50", className: "c50" },
  { millis: 25000n, label: "25", className: "c25" },
  { millis: 10000n, label: "10", className: "c10" },
  { millis: 5000n, label: "5", className: "c5" },
];

export function chipsFromMillis(millis: string): VisualChip[] {
  let remaining = BigInt(millis);
  const chips: VisualChip[] = [];
  if (remaining <= 0n) return chips;
  for (const denom of DENOMS) {
    while (remaining >= denom.millis && chips.length < 6) {
      chips.push({ label: denom.label, className: denom.className });
      remaining -= denom.millis;
    }
  }
  if (remaining > 0n && chips.length < 6) {
    chips.push({ label: formatJetons(remaining), className: "c5" });
  }
  return chips;
}
