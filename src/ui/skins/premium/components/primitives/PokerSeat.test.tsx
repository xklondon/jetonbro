import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokerSeat } from "./PokerSeat";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

describe("Premium PokerSeat", () => {
  it("renders CasinoJeton stacks instead of blank green pills", () => {
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
        },
        style: { left: "50%", top: "80%" },
        wagerStyle: { left: "50%", top: "55%" },
        showStartingStack: true,
      }),
    );
    expect(html).toContain('data-casino-jeton="true"');
    expect(html).toContain('data-chip-stack="true"');
    expect(html).toContain('data-starting-stack="true"');
    expect(html).toContain('data-street-wager="true"');
    expect(html).not.toContain("pm-poker-stack-chip");
  });
});
