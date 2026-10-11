import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlackjackPayoutOverlay } from "./BlackjackSettlementBar";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function box(
  id: string,
  playerId: string,
  playerName: string,
  boxNumber: number,
  stake: string,
  outcome: "LOST" | "PUSH" | "BLACKJACK" | "WON" | null = null,
) {
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
    outcome,
    returned: null,
    payoutActions: [],
  };
}

describe("Premium Blackjack payout overlay", () => {
  it("shows per-box MAIN BET and a single-row Lost/Tie/Blackjack/Win rail", () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPayoutOverlay, {
        boxes: [
          box("b1", "p1", "Casey", 1, "25"),
          box("b2", "p1", "Casey", 2, "50"),
        ],
        enabled: true,
        onSettle: () => undefined,
      }),
    );
    expect(html).toContain('data-bj-layout="payout"');
    expect(html).toContain('data-payout-overlay="true"');
    expect(html).toContain("BOX 1");
    expect(html).toContain("BOX 2");
    expect(html).toContain("MAIN BET 25");
    expect(html).toContain("MAIN BET 50");
    expect(html).not.toContain("2 Boxes");
    expect(html).not.toContain("Boxes");
    // Single-player table: no aggregate player header noise
    expect(html).not.toContain("Casey");

    const lost = html.indexOf('data-outcome="LOST"');
    const push = html.indexOf('data-outcome="PUSH"');
    const bj = html.indexOf('data-outcome="BLACKJACK"');
    const won = html.indexOf('data-outcome="WON"');
    expect(lost).toBeGreaterThan(-1);
    expect(push).toBeGreaterThan(lost);
    expect(bj).toBeGreaterThan(push);
    expect(won).toBeGreaterThan(bj);
    expect(html).toContain("Lost");
    expect(html).toContain("Tie");
    expect(html).toContain("Blackjack");
    expect(html).toContain("Win");
    expect(html).toContain("pm-outcome-icon");
    expect(html).toContain('data-payout-state="pending"');
  });

  it("groups by player name only when multiple players are present", () => {
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
    expect(html).toContain('data-player-group="p1"');
    expect(html).toContain('data-player-group="p2"');
    expect(html.match(/Casey/g)?.length).toBeGreaterThanOrEqual(1);
    expect(html.match(/Alex/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it("marks settled boxes with the declared outcome", () => {
    const html = renderToStaticMarkup(
      createElement(BlackjackPayoutOverlay, {
        boxes: [box("b1", "p1", "Casey", 1, "50", "WON")],
        enabled: true,
      }),
    );
    expect(html).toContain('data-payout-state="WON"');
    expect(html).toContain('data-box-result="WON"');
    expect(html).toContain("is-settled");
    expect(html).not.toContain('data-payout-action="true"');
  });
});
