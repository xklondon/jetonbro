import { createElement } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import { selectTableBoard } from "./table-board";
import { ACTIVE_SKIN_ID } from "@/ui/skins/registry";
import { tabletopSkin } from "@/ui/skins/tabletop";

const money = (label: string, millis = `${Number(label) * 1000}`) => ({ millis, label });

const members: MemberView[] = [
  { userId: "d1", name: "Dee", email: "d@x.io", isOwner: true, isBankDealer: true, available: money("0") },
  { userId: "p1", name: "Alex", email: "a@x.io", isOwner: false, isBankDealer: false, available: money("100") },
];

const box = (n: number, overrides: Partial<BoxView> = {}): BoxView => ({
  id: `b${n}`,
  playerId: "p1",
  playerName: "Alex",
  label: `BOX ${n}`,
  boxNumber: n,
  bet: money("25"),
  originalStake: money("25"),
  isDoubled: false,
  isSplit: false,
  insurance: null,
  insuranceMax: money("12.5", "12500"),
  insuranceResult: null,
  outcome: null,
  returned: null,
  payoutActions: [],
  ...overrides,
});

function bank(phase: BankTableView["phase"], extra: Partial<BankTableView> = {}): BankTableView {
  const boxes = phase === "TABLE_SETUP" ? [] : [box(1)];
  return {
    role: "BANK",
    phase,
    tableName: "Salon",
    title: "",
    copy: "",
    phaseLabel: phase,
    primaryAction:
      phase === "TABLE_SETUP"
        ? { id: "nextHand", label: "START BETTING", enabled: false }
        : phase === "BETTING"
          ? { id: "dealCards", label: "DEAL CARDS", enabled: true }
          : phase === "PLAYING"
            ? { id: "payoutPhase", label: "ENTER PAYOUT", enabled: true }
            : { id: "nextHand", label: "START BETTING", enabled: true },
    boxes,
    players:
      phase === "TABLE_SETUP"
        ? [{ userId: "p1", name: "Alex", available: money("100"), locked: money("0", "0"), status: "Waiting", boxes: [] }]
        : [{ userId: "p1", name: "Alex", available: money("75"), locked: money("25"), status: "", boxes }],
    playerCount: 1,
    boxCount: boxes.length,
    lockedOrdinary: money(phase === "TABLE_SETUP" ? "0" : "25"),
    insurance: { window: phase === "PLAYING" && extra.insurance?.window === "OPEN" ? "OPEN" : "CLOSED", total: money("0", "0"), count: 0, resolution: null },
    actions: {
      dealCards: phase === "BETTING",
      scheduleDeal: phase === "BETTING",
      payoutPhase: phase === "PLAYING",
      nextHand: phase === "PAYOUT" || phase === "ROUND_COMPLETE" || phase === "TABLE_SETUP",
      scheduleNextRound: false,
      openInsurance: phase === "PLAYING",
      closeInsurance: false,
      settleBoxes: phase === "PAYOUT",
      settleDealerWon: phase === "PAYOUT",
      settleInsurance: false,
      addPlayer: phase === "BETTING" || phase === "TABLE_SETUP",
      giveJetons: phase === "BETTING",
      changeBank: true,
      saveTable: true,
      closeTable: true,
      switchGame: true,
    },
    insuranceSettleActions: [],
    bettingCloseDeadlineAt: null,
    nextRoundDeadlineAt: null,
    hasValidBet: phase === "BETTING",
    isOwner: true,
    tableStatus: phase === "TABLE_SETUP" ? "SETUP" : "ACTIVE",
    paused: false,
    closePreview: null,
    dealerName: "Dee",
    canStartBetting: false,
    ...extra,
  };
}

const PHASES: BankTableView["phase"][] = ["TABLE_SETUP", "BETTING", "PLAYING", "PAYOUT", "ROUND_COMPLETE"];

describe("Blackjack Tabletop render path", () => {
  it("activates tabletop skin", () => {
    expect(ACTIVE_SKIN_ID).toBe("tabletop");
    expect(tabletopSkin.id).toBe("tabletop");
  });

  it("every Blackjack Dealer/Player state selects one Tabletop board (never Classic mount)", () => {
    for (const phase of PHASES) {
      expect(
        selectTableBoard({
          isOwner: true,
          isDealer: true,
          game: "BLACKJACK",
          phase,
          setup: { setupCompleted: true },
        }),
      ).toBe("BLACKJACK_DEALER");
      expect(
        selectTableBoard({
          isOwner: false,
          isSeatedPlayer: true,
          game: "BLACKJACK",
          phase: phase === "TABLE_SETUP" ? "TABLE_SETUP" : phase,
        }),
      ).toBe(phase === "TABLE_SETUP" ? "PHASE_ZERO_PLAYER" : "BLACKJACK_PLAYER");
    }
  });

  it("Dealer BankTable mounts canonical felt for all phases with persistent dealer slot", () => {
    const anatomies = PHASES.map((phase) => {
      const html = renderToStaticMarkup(
        createElement(tabletopSkin.BankTable, {
          view: bank(phase, phase === "PLAYING" ? { insurance: { window: "OPEN", total: money("10"), count: 1, resolution: null } } : {}),
          members,
          onCommand: () => undefined,
        }),
      );
      expect(html).toContain('data-table-board="BLACKJACK_DEALER"');
      expect(html).toContain('data-bj-felt="true"');
      expect(html).toContain('data-dealer-slot="true"');
      expect(html).toContain('data-bj-anatomy="dealer"');
      expect(html).not.toContain("tt-setup-ledger");
      expect(html).not.toContain("Classic");
      expect(html.match(/Salon/g)?.length ?? 0).toBeLessThanOrEqual(2);
      return html;
    });
    for (const html of anatomies) {
      expect(html).toContain("DEALER");
      expect(html).toContain("Dee");
    }
  });

  it("Player Betting shows retract X; Playing does not", () => {
    const { PlayerTable } = tabletopSkin;
    const betting = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: {
          role: "PLAYER",
          phase: "BETTING",
          tableName: "Salon",
          title: "",
          copy: "",
          available: money("75"),
          boxes: [box(1)],
          insuranceWindowOpen: false,
          bettingCloseDeadlineAt: null,
          nextRoundDeadlineAt: null,
          actions: { bet: true, retract: true, addBox: true, removeEmptyBox: false, double: false, split: false, insurance: false },
        },
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(betting).toContain('data-retract-box="b1"');
    expect(betting).toContain("Retract Box 1 wager");
    expect(betting).not.toContain(">RETRACT<");

    const playing = renderToStaticMarkup(
      createElement(PlayerTable, {
        view: {
          role: "PLAYER",
          phase: "PLAYING",
          tableName: "Salon",
          title: "",
          copy: "",
          available: money("75"),
          boxes: [box(1)],
          insuranceWindowOpen: false,
          bettingCloseDeadlineAt: null,
          nextRoundDeadlineAt: null,
          actions: { bet: false, retract: false, addBox: false, removeEmptyBox: false, double: true, split: true, insurance: true },
        },
        selectedBoxId: "b1",
        onSelectBox: () => undefined,
        onCommand: () => undefined,
      }),
    );
    expect(playing).not.toContain("data-retract-box");
  });

  it("no numbered-copy TS/TSX files and Tabletop CSS ownership stays isolated", () => {
    function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        if (name === "node_modules" || name === ".next" || name === ".git") return [];
        const full = join(dir, name);
        return statSync(full).isDirectory() ? walk(full) : [full];
      });
    }
    const roots = [join(process.cwd(), "src"), join(process.cwd(), "e2e")];
    const junk = roots.flatMap((root) => walk(root)).filter((file) => / \(\d+\)\.(ts|tsx)$/.test(file));
    expect(junk).toEqual([]);
    const index = readFileSync(join(process.cwd(), "src/ui/skins/tabletop/index.ts"), "utf8");
    expect(index).toContain('import "./tabletop.css"');
    expect(index).toContain("BankTable");
    expect(index).not.toMatch(/classic\/styles|\.\/classic["']/);
    const bankAdapter = readFileSync(join(process.cwd(), "src/ui/skins/tabletop/components/BankTable.tsx"), "utf8");
    expect(bankAdapter).toContain("BlackjackDealerTable");
    const css = readFileSync(join(process.cwd(), "src/ui/skins/tabletop/tabletop.css"), "utf8");
    expect(css).toContain(".tabletop-skin .tt-bj-felt");
    expect(css).toContain(".tabletop-skin .tt-bj-dealer-slot");
    expect(css).not.toMatch(/(?<!\.)\n\.box\s*\{|(?<!\.)\n\.table\s*\{|(?<!\.)\n\.dealer\s*\{|(?<!\.)\n\.felt\s*\{/);
    expect(css).not.toMatch(/classic-skin|classic\/board/);
    // Phase modifiers must not redefine felt structural geometry
    const phaseBlocks = [...css.matchAll(/\.tt-bj-dealer\[data-bj-phase[^\]]*\][^{]*\{([^}]*)\}/g)].map((m) => m[1]);
    for (const block of phaseBlocks) {
      expect(block).not.toMatch(/display\s*:|grid-template|flex-direction|width\s*:|height\s*:|min-height\s*:/);
    }
  });
});
