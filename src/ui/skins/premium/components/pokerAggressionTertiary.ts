import type { PokerDockTrio } from "@/application/queries/poker-controls";

type DockAction = {
  label: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
};

/**
 * RAISE/BET opens compose (no fixed amount on the button).
 * Confirm appears once compose has a legal target street wager (typed or chip-built).
 * For RAISE/BET, pendingAmount is the intended total street wager; pendingAct.amount is raise-to/bet.
 */
export function pokerAggressionTertiary(input: {
  trio: PokerDockTrio;
  trayEnabled: boolean;
  composeOpen: boolean;
  pendingAct: { type: "BET" | "RAISE"; amount: string } | null;
  pendingAmount: number;
  minChip: number | null;
  maxChip: number | null;
  onOpenCompose: () => void;
  onConfirm: () => void;
  dealStreet?: DockAction | null;
}): DockAction | null {
  const {
    trio,
    trayEnabled,
    composeOpen,
    pendingAct,
    pendingAmount,
    minChip,
    maxChip,
    onOpenCompose,
    onConfirm,
    dealStreet = null,
  } = input;

  if (composeOpen && trayEnabled) {
    const submitAmount = pendingAct ? Number(pendingAct.amount) : pendingAmount;
    const overMax = maxChip != null && Number.isFinite(maxChip) && submitAmount > maxChip;
    const underMin = minChip != null && pendingAmount > 0 && pendingAmount < minChip;
    return {
      label: pendingAct ? `CONFIRM ${pendingAct.amount}` : "CONFIRM",
      disabled: !pendingAct || overMax,
      title: !pendingAct
        ? underMin && minChip != null
          ? `Minimum ${minChip}`
          : overMax && maxChip != null
            ? `Maximum ${maxChip}`
            : trio.aggression?.type === "RAISE"
              ? "Add chips or type a raise-to total"
              : minChip != null
                ? `Enter bet (min ${minChip})`
                : "Enter a legal amount"
        : undefined,
      onClick: () => {
        if (!pendingAct || overMax) return;
        onConfirm();
      },
    };
  }

  if (trio.aggression && trayEnabled) {
    const kind = trio.aggression.type === "RAISE" ? "RAISE" : "BET";
    return {
      label: kind,
      disabled: false,
      title: kind === "RAISE" ? "Open raise-to total" : "Open bet amount",
      onClick: onOpenCompose,
    };
  }

  if (trio.aggression) {
    return {
      label: trio.aggression.type === "RAISE" ? "RAISE" : "BET",
      disabled: true,
      title: "Waiting for your turn",
    };
  }

  return dealStreet;
}
