import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SetupTableView } from "@/application/queries/views";
import { PremiumCreateTable } from "./PremiumCreateTable";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

function setupView(): SetupTableView {
  return {
    role: "SETUP",
    phase: "TABLE_SETUP",
    tableName: "Draft Salon",
    game: "Blackjack",
    gameId: "BLACKJACK",
    gameOptions: [
      { id: "BLACKJACK", label: "Blackjack", available: true },
      { id: "POKER", label: "Texas Hold’em", available: true },
    ],
    ownerName: "Owner",
    bankName: "Owner",
    startingJetonsPerPlayer: money("100"),
    seats: [],
    members: [{ userId: "u1", name: "Owner", email: "o@x.io", isOwner: true, isBankDealer: true, available: money("0") }],
    invitations: [],
    joinUrl: null,
    minBet: null,
    maxBet: null,
    blackjackPayout: "THREE_TWO",
    maxBoxesPerPlayer: 3,
    insuranceEnabled: true,
    bankMayDistributeJetons: true,
    canStartBetting: false,
    startBlockedReason: null,
    isOwner: true,
    setupCompleted: false,
    tableStatus: "SETUP",
    paused: false,
    closePreview: null,
    bankFundingMode: "OPEN",
    startingBank: money("500"),
  };
}

describe("PremiumCreateTable start flow", () => {
  it("renders START TABLE and CREATE_TABLE board markers", () => {
    const html = renderToStaticMarkup(
      createElement(PremiumCreateTable, {
        defaultTableName: "Draft Salon",
        defaultStartingJetons: "100",
        view: setupView(),
        onCommand: async () => true,
        onCreate: async () => undefined,
        onBack: () => undefined,
      }),
    );
    expect(html).toContain("START TABLE");
    expect(html).toContain('data-table-board="CREATE_TABLE"'); // PremiumShell board prop
    expect(html).toContain('aria-label="Table name"');
    expect(html).toContain('aria-label="Starting jetons per player"');
  });

  it("uses updateSettings then finalizeSetup when view and onCommand are present", () => {
    const source = readFileSync(join(__dirname, "PremiumCreateTable.tsx"), "utf8");
    expect(source).toMatch(/if \(onCommand && view\)/);
    expect(source).toContain('await persist({');
    expect(source).toContain('await onCommand("finalizeSetup"');
    expect(source).toContain("stakeType");
    expect(source).toContain("bankFundingMode");
    expect(source).toContain("startingBank");
    expect(source).toContain("smallBlind");
    expect(source).toContain("bigBlind");
    expect(source).toContain("seatOrder");
    // Live TableSession passes a no-op onCreate — must not be the only path.
    expect(source).toMatch(/onCreate\(/);
    expect(source.indexOf('if (onCommand && view)')).toBeLessThan(source.indexOf("await onCreate("));
  });
});
