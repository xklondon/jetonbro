export const PLAYER_COPY: Record<string, [string, string]> = {
  BETTING: ["Place your bets", "All your open boxes remain visible"],
  PLAYING: ["Play your hands", "Select a box, then choose an action"],
  PAYOUT: ["Waiting for the Bank", "Results appear separately for every box"],
  ROUND_COMPLETE: ["Hand complete", "Your jetons carry into the next hand"],
};

export function playerTitleForPhase(
  phase: string,
  boxes: { outcome: string | null }[],
): string {
  if (phase === "PAYOUT") {
    return boxes.some((box) => !box.outcome) ? "Waiting for the Bank" : "Hand complete";
  }
  return PLAYER_COPY[phase]?.[0] ?? "JetonBro";
}
