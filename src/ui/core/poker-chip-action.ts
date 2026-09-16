import type { PokerLegalActionView } from "@/application/queries/views";

export function pokerChipAction(
  legal: PokerLegalActionView[],
  chipJetons: string,
  streetContributionMillis: string,
): { type: "BET" | "CALL" | "RAISE"; amount?: string } | null {
  if (!/^\d+$/.test(chipJetons)) return null;
  const chip = BigInt(chipJetons) * 1000n;
  if (chip <= 0n) return null;
  const bet = legal.find((action) => action.type === "BET");
  const call = legal.find((action) => action.type === "CALL");
  const raise = legal.find((action) => action.type === "RAISE");
  if (bet) return { type: "BET", amount: chipJetons };
  const owed = call ? BigInt(call.amount.millis) : 0n;
  if (call && (chip <= owed || !raise)) return { type: "CALL" };
  if (raise) {
    const street = BigInt(streetContributionMillis || "0");
    return { type: "RAISE", amount: ((street + chip) / 1000n).toString() };
  }
  return null;
}
