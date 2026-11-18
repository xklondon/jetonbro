import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PremiumBlackjackWaiting } from "./PremiumBlackjackWaiting";

describe("PremiumBlackjackWaiting", () => {
  it("uses PHASE_ZERO_PLAYER board with waiting banner and pinned tray", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumBlackjackWaiting, {
        view: {
          role: "WAITING",
          phase: "TABLE_SETUP",
          tableName: "EMERALD SALON",
          game: "Blackjack",
          gameId: "BLACKJACK",
          available: { millis: "100000", label: "100" },
          copy: "",
          bankName: "Dee",
        },
      }),
    );
    expect(html).toContain('data-table-board="PHASE_ZERO_PLAYER"');
    expect(html).toContain('data-bj-waiting-banner="true"');
    expect(html).toContain("WAITING FOR DEALER TO START THE GAME");
    expect(html).toContain('data-jeton-tray="true"');
    expect(html).toContain('data-tray-available="true"');
    expect(html).not.toContain('data-tray-cards="true"');
    expect(html).not.toContain("PLACE BET");
  });
});
