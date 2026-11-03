import { describe, expect, it, vi } from "vitest";
import type { PokerDockTrio } from "@/application/queries/poker-controls";
import { pokerAggressionTertiary } from "./pokerAggressionTertiary";

const money = (label: string) => ({ millis: `${Number(label) * 1000}`, label });

const raiseTrio: PokerDockTrio = {
  owed: true,
  fold: { type: "FOLD", amount: money("0"), label: "FOLD" },
  respond: { type: "CALL", amount: money("5"), label: "CALL 5" },
  aggression: { type: "RAISE", amount: money("90"), raiseTo: money("20"), label: "RAISE" },
  allIn: { type: "ALL_IN", amount: money("95"), label: "ALL IN 95" },
};

describe("pokerAggressionTertiary", () => {
  it("shows RAISE (not RAISE 20) and opens compose on click", () => {
    const onOpenCompose = vi.fn();
    const action = pokerAggressionTertiary({
      trio: raiseTrio,
      trayEnabled: true,
      composeOpen: false,
      pendingAct: null,
      pendingAmount: 0,
      minChip: 20,
      maxChip: 95,
      onOpenCompose,
      onConfirm: () => undefined,
    });
    expect(action?.label).toBe("RAISE");
    expect(action?.label).not.toMatch(/20/);
    expect(action?.disabled).toBe(false);
    action?.onClick?.();
    expect(onOpenCompose).toHaveBeenCalledTimes(1);
  });

  it("swaps to Confirm once compose has a legal amount", () => {
    const onConfirm = vi.fn();
    const action = pokerAggressionTertiary({
      trio: raiseTrio,
      trayEnabled: true,
      composeOpen: true,
      pendingAct: { type: "RAISE", amount: "25" },
      pendingAmount: 25,
      minChip: 20,
      maxChip: 95,
      onOpenCompose: () => undefined,
      onConfirm,
    });
    expect(action?.label).toBe("CONFIRM 25");
    expect(action?.disabled).toBe(false);
    action?.onClick?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables Confirm when amount exceeds AVAILABLE max", () => {
    const action = pokerAggressionTertiary({
      trio: raiseTrio,
      trayEnabled: true,
      composeOpen: true,
      pendingAct: { type: "RAISE", amount: "100" },
      pendingAmount: 100,
      minChip: 20,
      maxChip: 95,
      onOpenCompose: () => undefined,
      onConfirm: () => undefined,
    });
    expect(action?.label).toBe("CONFIRM 100");
    expect(action?.disabled).toBe(true);
  });
});
