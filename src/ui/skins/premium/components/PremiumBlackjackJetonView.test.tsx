import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BoxView } from "@/application/queries/views";
import { PremiumBlackjackJetonView } from "./PremiumBlackjackJetonView";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function box(n: number, overrides: Partial<BoxView> = {}): BoxView {
  return {
    id: `b${n}`,
    playerId: "p1",
    playerName: "Sam",
    label: `BOX ${n}`,
    boxNumber: n,
    bet: money("25"),
    originalStake: money("25"),
    isDoubled: false,
    isSplit: false,
    insurance: null,
    insuranceMax: money("12.5"),
    insuranceResult: null,
    outcome: null,
    returned: null,
    payoutActions: [],
    ...overrides,
  };
}

describe("PremiumBlackjackJetonView", () => {
  it("renders one and two box layouts with actual wager faces", () => {
    const one = renderToStaticMarkup(
      createElement(PremiumBlackjackJetonView, {
        boxes: [box(1, { bet: money("75"), originalStake: money("75") })],
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
      }),
    );
    expect(one).toContain("is-one");
    expect(one).toContain(">75<");
    expect(one).toContain('data-denom="50"');

    const two = renderToStaticMarkup(
      createElement(PremiumBlackjackJetonView, {
        boxes: [box(1), box(2, { id: "b2", bet: money("0"), originalStake: money("0") })],
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
      }),
    );
    expect(two).toContain("is-two");
    expect(two).toContain("pm-bj-jeton-empty-spot");
    expect(two).toContain('aria-pressed="true"');
  });

  it("uses scroll layout for three or more boxes", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackJetonView, {
        boxes: [box(1), box(2, { id: "b2" }), box(3, { id: "b3" })],
        selectedBoxId: "b2",
        onSelectBox: () => undefined,
      }),
    );
    expect(html).toContain("is-scroll");
    expect(html).toContain("pm-bj-jeton-dots");
    expect(html).toContain('data-box-count="3"');
  });

  it("prefers pending wager over committed stake", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackJetonView, {
        boxes: [box(1)],
        selectedBoxId: "b1",
        pendingByBoxId: { b1: "40" },
        onSelectBox: () => undefined,
      }),
    );
    expect(html).toContain(">40<");
  });
});
