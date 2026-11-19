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
  it("keeps ADD BOX in the left slot after a stake is locked and never shows NEXT ROUND", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView(),
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain("ADD BOX");
    expect(html).toContain('data-bj-player-slots="true"');
    expect(html).toContain('data-bj-slot="left"');
    expect(html).toContain('data-bj-slot="centre"');
    expect(html).toContain('data-bj-slot="right"');
    expect(html).not.toContain(">RETRACT<");
    expect(html).not.toContain('data-retract-chip="');
    expect(html).not.toContain(">PLACE BET<");
    expect(html).not.toContain("NEXT ROUND");
    expect(html).not.toContain("START HAND");
    expect(html).not.toContain("DEAL CARDS");
    expect(html).toContain("YOUR BET");
    expect(html).toContain('data-bj-pending-bet="true"');
    expect(html).toContain('data-bj-bet-cards-row="true"');
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain('data-tray-available="true"');
    expect(html).toContain('data-bj-inline-cards="true"');
    expect(html).not.toContain('aria-hidden="true" data-jeton-tray');
  });

  it("after allocation shows seat jetons on felt and real tray chips before betting", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView({
          phase: "TABLE_SETUP",
          boxes: [],
          available: money("100"),
          actions: {
            bet: false,
            retract: false,
            addBox: false,
            removeEmptyBox: false,
            double: false,
            split: false,
            insurance: false,
          },
        }),
        selectedBoxId: null,
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain('data-box-available="true"');
    expect(html).toContain("AVAILABLE");
    expect(html).not.toContain('data-seat-bankroll="true"');
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain('data-tray-available="true"');
    expect(html).toContain('data-bj-waiting-banner="true"');
    expect(html).toContain("WAITING FOR DEALER TO START THE GAME");
    expect(html).not.toContain('data-tray-cards="true"');
    expect(html).not.toContain("Waiting for betting to open");
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

  it("composes pending wagers locally and commits with SET", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/ui/skins/premium/components/PremiumBlackjackPlayer.tsx"), "utf8");
    expect(source).toContain('mode: "SET"');
    expect(source).toContain("orderBoxesForFelt");
    expect(source).not.toContain('mode: "ADD"');
    expect(source).toContain("Enter or tap your bet before PLACE BET");
    expect(source).not.toMatch(/onCommand\("startBetting"/);
    expect(source).not.toMatch(/onCommand\("dealCards"/);
    expect(source).not.toMatch(/onCommand\("enterPayout"/);
    expect(source).not.toMatch(/onCommand\("startNextRound"/);
    expect(source).not.toMatch(/onCommand\("scheduleDeal"/);
    expect(source).not.toMatch(/onCommand\("scheduleNextRound"/);
  });

  it("ROUND_COMPLETE staging uses PLACE BET only — never NEXT ROUND / phase commands", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView({
          phase: "ROUND_COMPLETE",
          boxes: [
            {
              id: "b1",
              playerId: "p1",
              playerName: "Casey",
              label: "Box 1",
              boxNumber: 1,
              bet: money("0"),
              originalStake: money("0"),
              nextRoundBet: money("0"),
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
            bet: false,
            retract: false,
            addBox: false,
            removeEmptyBox: false,
            double: false,
            split: false,
            insurance: false,
            nextRoundBet: true,
          },
        }),
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(html).toContain(">PLACE BET<");
    expect(html).toContain("YOUR BET");
    expect(html).not.toContain("NEXT ROUND");
    expect(html).not.toContain("START HAND");
    expect(html).not.toContain("DEAL CARDS");
    expect(html).not.toContain("ENTER PAYOUT");
    expect(html).not.toContain("START NEXT ROUND");
  });

  it("JETON VIEW shows only own boxes with hero wager and keeps the tray", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView({
          phase: "PLAYING",
          boxes: [
            {
              id: "b1",
              playerId: "p1",
              playerName: "Casey",
              label: "Box 1",
              boxNumber: 1,
              bet: money("75"),
              originalStake: money("75"),
              isDoubled: false,
              isSplit: false,
              insurance: null,
              insuranceMax: money("0"),
              insuranceResult: null,
              outcome: null,
              returned: null,
              payoutActions: [],
              hand: { ranks: ["K", "7"], complete: false, label: "17", suggestedOutcome: null, canEdit: true },
            },
            {
              id: "b2",
              playerId: "p1",
              playerName: "Casey",
              label: "Box 2",
              boxNumber: 2,
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
            bet: false,
            retract: false,
            addBox: false,
            removeEmptyBox: false,
            double: true,
            split: true,
            insurance: false,
          },
        }),
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
        initialBoardView: "jeton",
      }),
    );
    expect(html).toContain('data-bj-view-toggle="true"');
    expect(html).toContain('data-bj-view="jeton"');
    expect(html).toContain('data-bj-jeton-view="true"');
    expect(html).toContain('data-bj-jeton-hero="true"');
    expect(html).toContain(">75<");
    expect(html).toContain('data-bj-jeton-cards="true"');
    expect(html).toContain(">K<");
    expect(html).toContain(">7<");
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).not.toContain("pm-bj-frame");
  });

  it("empty wager in JETON VIEW shows a vacant spot instead of a fake chip", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackPlayer, {
        view: playerView({
          boxes: [
            {
              id: "b1",
              playerId: "p1",
              playerName: "Casey",
              label: "Box 1",
              boxNumber: 1,
              bet: money("0"),
              originalStake: money("0"),
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
        }),
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
        initialBoardView: "jeton",
      }),
    );
    expect(html).toContain("pm-bj-jeton-empty-spot");
    expect(html).not.toContain('data-bj-jeton-hero="true"');
  });
});
