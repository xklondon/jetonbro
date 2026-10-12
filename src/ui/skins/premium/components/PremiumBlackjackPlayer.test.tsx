import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlayerTableView } from "@/application/queries/views";
import { PremiumBlackjackPlayer } from "./PremiumBlackjackPlayer";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function playerView(overrides: Partial<PlayerTableView> = {}): PlayerTableView {
  return {
    role: "PLAYER",
    phase: "BETTING",
    tableName: "Emerald",
    title: "",
    copy: "",
    available: money("100"),
    insuranceWindowOpen: false,
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    boxes: [
      {
        id: "b1",
        playerId: "p1",
        playerName: "Casey",
        label: "Box 1",
        boxNumber: 1,
        bet: money("25"),
        originalStake: money("25"),
        isDoubled: false,
        isSplit: false,
        insurance: null,
        insuranceMax: money("0"),
        insuranceResult: null,
        outcome: null,
        returned: null,
        payoutActions: [],
      },
    ],
    actions: {
      bet: true,
      retract: true,
      addBox: true,
      removeEmptyBox: false,
      double: false,
      split: false,
      insurance: false,
    },
    ...overrides,
  };
}

describe("PremiumBlackjackPlayer betting dock", () => {
  it("keeps ADD BOX available after a stake is placed and exposes chip retract", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView(),
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("ADD BOX");
    expect(html).not.toContain(">RETRACT<");
    expect(html).toContain('data-retract-chip="25"');
    expect(html).toContain("PLACE BET");
  });

  it("wires 2× and SPLIT to doubleBox / splitBox command names", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/ui/skins/premium/components/PremiumBlackjackPlayer.tsx"), "utf8");
    expect(source).toContain('onCommand("doubleBox"');
    expect(source).toContain('onCommand("splitBox"');
    expect(source).toContain('onCommand("buyInsurance"');
    expect(source).not.toMatch(/onCommand\("double"/);
    expect(source).not.toMatch(/onCommand\("split"/);
  });
});
