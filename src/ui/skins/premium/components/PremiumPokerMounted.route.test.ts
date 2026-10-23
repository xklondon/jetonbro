import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACTIVE_SKIN_ID } from "@/ui/skins/registry";
import { selectTableBoard } from "@/ui/core/table-board";

/**
 * Route audit — production URL /tables/{tableId} must mount Premium Poker, not legacy FeltTray.
 */
describe("canonical /tables/[tableId] Poker mount", () => {
  it("app page mounts TableSession and active skin is premium", () => {
    const page = readFileSync(join(__dirname, "../../../../app/tables/[tableId]/page.tsx"), "utf8");
    expect(page).toContain("TableSession");
    expect(page).toContain("loadSnapshot");
    expect(ACTIVE_SKIN_ID).toBe("premium");

    const session = readFileSync(join(__dirname, "../../../core/TableSession.tsx"), "utf8");
    expect(session).toContain('board === "POKER_DEALER"');
    expect(session).toContain("skin.PokerDealer");
    expect(session).toContain("skin.PokerPlayer");
    expect(session).not.toContain("FeltTray");

    const registry = readFileSync(join(__dirname, "../../registry.ts"), "utf8");
    expect(registry).toContain('ACTIVE_SKIN_ID = "premium"');
    expect(registry).toContain("premiumSkin");
  });

  it("selectTableBoard routes owner/player to Premium Poker boards", () => {
    expect(
      selectTableBoard({
        isOwner: true,
        game: "POKER",
        phase: "PRE_FLOP",
        poker: { phase: "PRE_FLOP" },
      }),
    ).toBe("POKER_DEALER");
    expect(
      selectTableBoard({
        isOwner: false,
        isSeatedPlayer: true,
        game: "POKER",
        phase: "PRE_FLOP",
        poker: { phase: "PRE_FLOP" },
      }),
    ).toBe("POKER_PLAYER");
  });

  it("Premium skin wires PokerDealer/Player to mounted components", () => {
    const index = readFileSync(join(__dirname, "../index.ts"), "utf8");
    expect(index).toContain('PremiumPokerDealer as PokerDealer');
    expect(index).toContain('PremiumPokerPlayer as PokerPlayer');
    expect(index).not.toContain("FeltTray");
  });
});
