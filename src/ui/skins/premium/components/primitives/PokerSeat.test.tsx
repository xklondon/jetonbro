import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokerSeat } from "./PokerSeat";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

describe("Premium PokerSeat", () => {
  it("renders compact cockpit with external D badge and no seat TURN label", () => {
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
    expect(html).toContain('data-dealer-button="true"');
    expect(html).toContain('data-seat-cockpit="true"');
    expect(html).toContain("is-actor");
    expect(html).not.toContain('data-turn-marker="true"');
    expect(html).not.toContain("YOUR TURN");
    expect(html).not.toContain('data-street-wager="true"');
    expect(html).not.toContain("pm-poker-stack-chip");
    expect(html).not.toContain("pm-poker-seat-markers");
  });

  it("shows SB/BB as external badges and YOU for the local player", () => {
    const html = renderToStaticMarkup(
      createElement(PokerSeat, {
        seat: {
          userId: "v",
          name: "Dee",
          available: money("95"),
          contribution: money("5"),
          streetContribution: money("5"),
          toCall: money("0"),
          status: "ACTIVE",
          isDealer: false,
          isSmallBlind: true,
          isBigBlind: false,
          isActor: false,
          sittingOut: false,
          orderIndex: 0,
          hasHoleCards: false,
          holeCards: null,
        },
        style: { left: "50%", top: "82%" },
        isMe: true,
      }),
    );
    expect(html).toContain(">YOU<");
    expect(html).toContain('data-blind-badge="sb"');
    expect(html).toContain(">SB<");
    expect(html).not.toContain("pm-poker-seat-markers");
    expect(html).toContain('data-seat-balance="true"');
    expect(html).toContain("pm-poker-seat-chip-ico");
  });
});
