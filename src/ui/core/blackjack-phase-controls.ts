import type { BankTableView, BoxView, PlayerTableView } from "@/application/queries/views";

export type BlackjackControlKind = "primary" | "secondary" | "insurance" | "settle";

export type BlackjackControl = {
  id: string;
  label: string;
  command: string;
  enabled: boolean;
  kind: BlackjackControlKind;
};

export type BlackjackDealerPresentation = {
  phaseLabel: string;
  instruction: string;
  primary: BlackjackControl | null;
  secondary: BlackjackControl[];
  insurance: BlackjackControl | null;
  showAddPlayer: boolean;
  showPayoutResults: boolean;
  showInsuranceSettle: boolean;
};

export type BlackjackPlayerPresentation = {
  phaseLabel: string;
  instruction: string;
  placeBet: boolean;
  retract: boolean;
  addBox: boolean;
  double: boolean;
  split: boolean;
  insurance: boolean;
  trayEnabled: boolean;
  payoutIdle: boolean;
};

function stakePresent(box: BoxView | undefined) {
  if (!box) return false;
  try {
    return BigInt(box.bet.millis || "0") > 0n;
  } catch {
    return box.bet.label !== "0";
  }
}

export function blackjackPhaseLabel(input: {
  role: "DEALER" | "PLAYER";
  phase: string;
  insuranceOpen?: boolean;
  hasStake?: boolean;
}): string {
  if (input.role === "PLAYER" && input.insuranceOpen && input.phase === "PLAYING") return "INSURANCE OPEN";
  if (input.role === "DEALER" && input.insuranceOpen && input.phase === "PLAYING") return "INSURANCE";
  if (input.phase === "TABLE_SETUP") {
    return input.role === "PLAYER" ? "Waiting for the table to open betting." : "Table setup";
  }
  if (input.phase === "BETTING") return "BETTING";
  if (input.phase === "PLAYING") return "PLAYING";
  if (input.phase === "PAYOUT" || input.phase === "ROUND_COMPLETE") return "PAYOUT";
  return input.phase.replaceAll("_", " ");
}

export function blackjackPhaseInstruction(input: {
  role: "DEALER" | "PLAYER";
  phase: string;
  insuranceOpen?: boolean;
  hasStake?: boolean;
}): string {
  if (input.role === "PLAYER" && input.insuranceOpen && input.phase === "PLAYING") return "Take insurance (optional)";
  if (input.role === "DEALER" && input.insuranceOpen && input.phase === "PLAYING") return "Offer and manage insurance";
  if (input.phase === "TABLE_SETUP" || input.phase === "BETTING") return "";
  if (input.phase === "PLAYING") return input.role === "PLAYER" ? "Make your move" : "";
  if (input.phase === "PAYOUT" || input.phase === "ROUND_COMPLETE") return "";
  return "";
}

export function blackjackDealerControls(view: BankTableView): BlackjackDealerPresentation {
  const insuranceOpen = view.insurance.window === "OPEN";
  const phaseLabel = blackjackPhaseLabel({
    role: "DEALER",
    phase: view.phase,
    insuranceOpen,
  });
  const instruction = blackjackPhaseInstruction({
    role: "DEALER",
    phase: view.phase,
    insuranceOpen,
  });
  if (view.phase === "BETTING") {
    return {
      phaseLabel,
      instruction,
      primary: {
        id: "dealCards",
        label: "DEAL CARDS",
        command: "dealCards",
        enabled: Boolean(view.actions.dealCards && view.primaryAction.enabled),
        kind: "primary",
      },
      secondary: [],
      insurance: null,
      showAddPlayer: true,
      showPayoutResults: false,
      showInsuranceSettle: false,
    };
  }
  if (view.phase === "PLAYING") {
    const insurance: BlackjackControl | null = insuranceOpen
      ? {
          id: "closeInsurance",
          label: "CLOSE INSURANCE",
          command: "closeInsurance",
          enabled: view.actions.closeInsurance,
          kind: "insurance",
        }
      : view.actions.openInsurance
        ? {
            id: "openInsurance",
            label: "OPEN INSURANCE",
            command: "openInsurance",
            enabled: true,
            kind: "insurance",
          }
        : null;
    return {
      phaseLabel,
      instruction,
      primary: {
        id: "enterPayout",
        label: "ENTER PAYOUT",
        command: "enterPayout",
        enabled: Boolean(view.actions.payoutPhase && view.primaryAction.enabled),
        kind: "primary",
      },
      secondary: [],
      insurance,
      showAddPlayer: false,
      showPayoutResults: false,
      showInsuranceSettle: false,
    };
  }
  if (view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE") {
    return {
      phaseLabel,
      instruction,
      primary: {
        id: "startBetting",
        label: "START BETTING",
        command: "startNextRound",
        enabled: Boolean(view.actions.nextHand && view.primaryAction.enabled),
        kind: "primary",
      },
      secondary: [],
      insurance: null,
      showAddPlayer: false,
      showPayoutResults: view.actions.settleBoxes,
      showInsuranceSettle: view.actions.settleInsurance,
    };
  }
  if (view.phase === "TABLE_SETUP") {
    return blackjackDealerSetupControls(false);
  }
  return {
    phaseLabel,
    instruction,
    primary: null,
    secondary: [],
    insurance: null,
    showAddPlayer: false,
    showPayoutResults: false,
    showInsuranceSettle: false,
  };
}

export function blackjackDealerSetupControls(canStartBetting: boolean): BlackjackDealerPresentation {
  return {
    phaseLabel: blackjackPhaseLabel({ role: "DEALER", phase: "TABLE_SETUP" }),
    instruction: blackjackPhaseInstruction({ role: "DEALER", phase: "TABLE_SETUP" }),
    primary: {
      id: "startBetting",
      label: "START BETTING",
      command: "startBetting",
      enabled: canStartBetting,
      kind: "primary",
    },
    secondary: [],
    insurance: null,
    showAddPlayer: true,
    showPayoutResults: false,
    showInsuranceSettle: false,
  };
}

export function blackjackPlayerControls(view: PlayerTableView, selected: BoxView | undefined): BlackjackPlayerPresentation {
  const betting = view.phase === "BETTING";
  const playing = view.phase === "PLAYING";
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const owned = Boolean(selected && selected.playerId);
  return {
    phaseLabel: blackjackPhaseLabel({
      role: "PLAYER",
      phase: view.phase,
      insuranceOpen: view.insuranceWindowOpen,
      hasStake: stakePresent(selected) || view.boxes.some((box) => stakePresent(box)),
    }),
    instruction: blackjackPhaseInstruction({
      role: "PLAYER",
      phase: view.phase,
      insuranceOpen: view.insuranceWindowOpen,
      hasStake: stakePresent(selected) || view.boxes.some((box) => stakePresent(box)),
    }),
    placeBet: betting && view.actions.bet,
    retract: betting && view.actions.retract && stakePresent(selected),
    addBox: betting && view.actions.addBox,
    double: playing && view.actions.double && owned && selected?.coverage?.double !== false,
    split: playing && view.actions.split && owned && selected?.coverage?.split !== false,
    insurance:
      playing &&
      view.actions.insurance &&
      view.insuranceWindowOpen &&
      owned &&
      selected?.coverage?.insurance !== false,
    trayEnabled: betting && view.actions.bet && selected?.coverage?.bet !== false,
    payoutIdle: payout,
  };
}

/** Visual 3-slot stage: Box 1 centre, Box 2 left, Box 3 right. */
export function playerBoxSlotIndex(boxNumber: number): number {
  if (boxNumber === 1) return 1;
  if (boxNumber === 2) return 0;
  if (boxNumber === 3) return 2;
  return -1;
}

export function blackjackOwnerMenu(input: {
  isOwner?: boolean;
  phase: string;
  changeDealer?: boolean;
  changeGame?: boolean;
  insuranceOpen?: boolean;
  payoutResolved?: boolean;
}): { changeDealer: boolean; changeGame: boolean } {
  if (!input.isOwner) return { changeDealer: false, changeGame: false };
  const payoutSafe =
    (input.phase === "PAYOUT" || input.phase === "ROUND_COMPLETE") && Boolean(input.payoutResolved);
  const unsafe =
    input.phase === "PLAYING" ||
    Boolean(input.insuranceOpen) ||
    ((input.phase === "PAYOUT" || input.phase === "ROUND_COMPLETE") && !input.payoutResolved);
  const safe = input.phase === "TABLE_SETUP" || input.phase === "BETTING" || payoutSafe;
  return {
    changeDealer: Boolean(input.changeDealer) && safe && !unsafe,
    changeGame: Boolean(input.changeGame) && safe && !unsafe,
  };
}

export function eligibleDealerCandidates<T extends { userId: string }>(members: T[]): T[] {
  return members.filter((member) => Boolean(member.userId));
}

export function playerBoxSlots<T extends { boxNumber: number }>(boxes: T[]): { slots: Array<T | null>; extras: T[] } {
  const slots: Array<T | null> = [null, null, null];
  const extras: T[] = [];
  for (const box of boxes) {
    const index = playerBoxSlotIndex(box.boxNumber);
    if (index >= 0 && !slots[index]) slots[index] = box;
    else extras.push(box);
  }
  return { slots, extras };
}
