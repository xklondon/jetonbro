import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PokerPot } from "./PokerPot";

describe("PokerPot", () => {
  it("renders a centered jeton cluster whose faces sum to the pot", () => {
    const html = renderToStaticMarkup(
      createElement(PokerPot, { amount: "60", millis: "60000" }),
    );
    expect(html).toContain('data-pot-chips="true"');
    expect(html).toContain('data-pot-chip-sum="60"');
    expect(html).toContain("pm-poker-pot-cluster");
    expect(html).toContain(">POT<");
    expect(html).toContain('data-pot-amount="60"');
    expect(html).toContain("data-casino-jeton");
    expect(html).not.toContain("data-side-pots");
    expect(html).not.toContain("-pad-");
  });

  it("shows side-pot labels only when side pots exist", () => {
    const html = renderToStaticMarkup(
      createElement(PokerPot, {
        amount: "80",
        millis: "80000",
        sidePots: [{ index: 1, label: "20" }],
      }),
    );
    expect(html).toContain('data-side-pots="true"');
    expect(html).toContain("SIDE 1 · 20");
  });
});
