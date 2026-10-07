/**
 * Test-only visual gallery: renders primitives to static markup so CI can assert
 * the approved primitive contracts without a production route.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionDock } from "./components/primitives/ActionDock";
import { ChipStack, Jeton } from "./components/primitives/Jeton";
import { DealerLedger, DealerLedgerRow } from "./components/primitives/DealerLedger";
import { PhaseDisplay } from "./components/primitives/PhaseDisplay";
import { PlayerBox } from "./components/primitives/PlayerBox";
import { TableButton } from "./components/primitives/TableButton";
import { TableName } from "./components/primitives/TableName";
import { TableRail } from "./components/primitives/TableRail";

const money = (label: string) => ({ millis: String(Number(label) * 1000), label });

describe("tabletop approved primitives gallery", () => {
  it("exposes layered jetons, structural rail, and button variants", () => {
    const html = [
      renderToStaticMarkup(createElement(TableRail)),
      renderToStaticMarkup(createElement(Jeton, { denomination: "25", size: "md" })),
      renderToStaticMarkup(createElement(ChipStack, { millis: "25000" })),
      renderToStaticMarkup(createElement(TableButton, { variant: "primary", children: "START BETTING" })),
      renderToStaticMarkup(createElement(TableButton, { variant: "secondary", children: "ADD PLAYER" })),
      renderToStaticMarkup(createElement(TableButton, { variant: "primary", disabled: true, children: "START BETTING" })),
      renderToStaticMarkup(createElement(PhaseDisplay, { display: "BETTING", label: "BETTING" })),
      renderToStaticMarkup(createElement(TableName, { name: "Salon" })),
    ].join("\n");
    expect(html).toContain("tt-rail-svg");
    expect(html).toContain("tt-jeton");
    expect(html).toContain("tt-jeton-edge");
    expect(html).toContain("tt-jeton-ring");
    expect(html).toContain("tt-btn-primary");
    expect(html).toContain("tt-btn-secondary");
    expect(html).toContain('data-phase-heading');
    expect(html).toContain('data-table-name="Salon"');
    expect(html).not.toMatch(/border: 3px dashed/);
    expect(html).not.toContain("data-arc");
  });

  it("renders PlayerBox and DealerLedger for real data only", () => {
    const box = {
      id: "b1",
      playerId: "p1",
      playerName: "Casey",
      label: "BOX 1",
      boxNumber: 1,
      bet: money("25"),
      originalStake: money("25"),
      isDoubled: false,
      isSplit: false,
      insurance: null,
      insuranceResult: null,
      outcome: null,
      returned: null,
      payoutActions: [],
    };
    const playerHtml = renderToStaticMarkup(
      createElement(PlayerBox, {
        box,
        selected: true,
        onSelect: () => undefined,
      }),
    );
    expect(playerHtml).toContain('data-box-id="b1"');
    expect(playerHtml).toContain("tt-pbox");
    expect(playerHtml).toContain("tt-chip-stack");

    const ledger = renderToStaticMarkup(
      createElement(DealerLedger, {
        children: createElement(DealerLedgerRow, {
          box,
          phase: "BETTING",
          payoutEnabled: false,
        }),
      }),
    );
    expect(ledger).toContain("tt-bj-overlay-list");
    expect(ledger).toContain("Casey");
    expect(ledger).not.toContain("data-dealer-positions");

    const dock = renderToStaticMarkup(
      createElement(ActionDock, {
        primary: { label: "DEAL CARDS", onClick: () => undefined },
        secondary: { label: "ADD PLAYER", onClick: () => undefined, addPlayer: true },
      }),
    );
    expect(dock).toContain("DEAL CARDS");
    expect(dock).toContain("ADD PLAYER");
    expect(dock).toContain("data-dealer-dock");
  });
});
