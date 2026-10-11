import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlackjackPayoutOverlay } from "./BlackjackSettlementBar";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function box(id: string, playerId: string, playerName: string, boxNumber: number, stake: string) {
  return {
    id,
    playerId,
    playerName,
    label: `Box ${boxNumber}`,
    boxNumber,
    bet: money(stake),
    originalStake: money(stake),
    isDoubled: false,
    isSplit: false,
    insurance: null,
    insuranceMax: money("0"),
    insuranceResult: null,
    outcome: null as null,
    returned: null,
    payoutActions: [],
  };
}

describe("Premium Blackjack payout overlay", () => {
  it("groups boxes by player with full outcome labels", () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPayoutOverlay, {
        boxes: [
          box("b1", "p1", "Casey", 1, "25"),
          box("b2", "p1", "Casey", 2, "50"),
          box("b3", "p2", "Alex", 1, "25"),
        ],
        enabled: true,
        onSettle: () => undefined,
      }),
    );
    expect(html).toContain('data-bj-layout="payout"');
    expect(html).toContain('data-player-group="p1"');
    expect(html).toContain('data-player-group="p2"');
    expect(html.match(/Casey/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html).toContain("Lost");
    expect(html).toContain("Tie");
    expect(html).toContain("Blackjack");
    expect(html).toContain("Win");
    expect(html).toContain('data-payout-action="true"');
    expect(html).toContain("BOX 1");
    expect(html).toContain("BOX 2");
  });
});
