import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokerSeat } from "./PokerSeat";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

describe("Premium PokerSeat", () => {
  it("renders compact plaque + starting CasinoJeton stack without seat wager chips", () => {
    const html = renderToStaticMarkup(
      createElement(PokerSeat, {
        seat: {
          userId: "u1",
          name: "Vi",
          available: money("100"),
          contribution: money("0"),
          streetContribution: money("25"),
          toCall: money("0"),
          status: "ACTIVE",
          isDealer: true,
          isSmallBlind: false,
          isBigBlind: false,
          isActor: true,
          sittingOut: false,
          orderIndex: 0,
          hasHoleCards: false,
          holeCards: null,
        },
        style: { left: "50%", top: "80%" },
        showStartingStack: true,
      }),
    );
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain('data-chip-stack="true"');
    expect(html).toContain('data-starting-stack="true"');
    expect(html).toContain("D");
    expect(html).not.toContain('data-street-wager="true"');
    expect(html).not.toContain("pm-poker-stack-chip");
  });
});
