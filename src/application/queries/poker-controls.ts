import { formatJetons } from "@/domain/money";
import type { PokerLegalActionView, PokerTableView } from "./views";

export type PokerControlLayer = "owner" | "actor";
export type PokerControlSurface = "dock" | "menu";
export type PokerComposeKind = "BET" | "RAISE";

export type PokerControl = {
  id: string;
  layer: PokerControlLayer;
  surface: PokerControlSurface;
  label: string;
  enabled: boolean;
  hint?: string;
};

export type PokerActorLayout = {
  owed: boolean;
  primary: PokerLegalActionView | null;
  secondary: PokerLegalActionView[];
};

export function pokerActorLayout(legal: PokerLegalActionView[]): PokerActorLayout {
  const fold = legal.find((action) => action.type === "FOLD") ?? null;
  const check = legal.find((action) => action.type === "CHECK") ?? null;
  const call = legal.find((action) => action.type === "CALL") ?? null;
  const bet = legal.find((action) => action.type === "BET") ?? null;
  const raise = legal.find((action) => action.type === "RAISE") ?? null;
  const allIn = legal.find((action) => action.type === "ALL_IN") ?? null;
  if (call) {
    return {
      owed: true,
      primary: call,
      secondary: [fold, raise, allIn].filter((action): action is PokerLegalActionView => Boolean(action)),
    };
  }
  return {
    owed: false,
    primary: check,
    secondary: [bet, raise, allIn, fold].filter((action): action is PokerLegalActionView => Boolean(action)),
  };
}

export function pokerActorActions(legal: PokerLegalActionView[]): PokerLegalActionView[] {
  const layout = pokerActorLayout(legal);
  return [layout.primary, ...layout.secondary].filter((action): action is PokerLegalActionView => Boolean(action));
}

/** Premium dock: FOLD + CHECK/CALL + BET/RAISE + ALL IN (chips submit legal target street wagers). */
export type PokerDockTrio = {
  owed: boolean;
  fold: PokerLegalActionView | null;
  respond: PokerLegalActionView | null;
  aggression: PokerLegalActionView | null;
  allIn: PokerLegalActionView | null;
};

export function pokerDockTrio(legal: PokerLegalActionView[]): PokerDockTrio {
  const fold = legal.find((action) => action.type === "FOLD") ?? null;
  const call = legal.find((action) => action.type === "CALL") ?? null;
  const check = legal.find((action) => action.type === "CHECK") ?? null;
  const bet = legal.find((action) => action.type === "BET") ?? null;
  const raise = legal.find((action) => action.type === "RAISE") ?? null;
  const allIn = legal.find((action) => action.type === "ALL_IN") ?? null;
  if (call) {
    return { owed: true, fold, respond: call, aggression: raise, allIn };
  }
  // Prefer RAISE whenever legal (BB option). Never substitute BET for RAISE.
  return { owed: false, fold, respond: check, aggression: raise ?? bet, allIn };
}

export function pokerActPayload(action: PokerLegalActionView): { type: string; amount: string } {
  if (action.type === "FOLD" || action.type === "CHECK") {
    return { type: action.type, amount: "0" };
  }
  if (action.type === "RAISE") {
    return { type: "RAISE", amount: action.raiseTo?.label ?? action.amount.label };
  }
  return { type: action.type, amount: action.amount.label };
}

/** Button label only — never bake min raise-to / stack max into the control text. */
export function pokerAggressionLabel(action: PokerLegalActionView): string {
  if (action.type === "RAISE") return "RAISE";
  if (action.type === "BET") return "BET";
  return action.label;
}

function millis(value: string | undefined): bigint {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}

export function visiblePokerLegalActions(view: PokerTableView): PokerLegalActionView[] {
  if (view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" || view.phase === "POKER_SETUP") return [];
  if (view.viewerStatus === "FOLDED" || view.viewerStatus === "ALL_IN") return [];
  const available = millis(view.available.millis);
  const owed = millis(view.toCall.millis);
  return view.legalActions
    .filter((action) => {
      if (action.type === "CALL") return owed > 0n && available > 0n && millis(action.amount.millis) > 0n;
      if (action.type === "CHECK") return owed === 0n;
      if (action.type === "BET" || action.type === "RAISE" || action.type === "ALL_IN") return available > 0n;
      return true;
    })
    .map((action) => {
      if (action.type !== "CALL") return action;
      const amount = available >= owed && owed > 0n ? view.toCall : action.amount;
      return { ...action, amount, label: `CALL ${amount.label}` };
    });
}

export function pokerTrayEnabled(view: Pick<PokerTableView, "legalActions" | "available" | "viewerStatus">): boolean {
  if (view.viewerStatus === "FOLDED" || view.viewerStatus === "ALL_IN") return false;
  if (millis(view.available.millis) === 0n) return false;
  return view.legalActions.some((action) => action.type === "BET" || action.type === "RAISE");
}

/**
 * Resolve a composed target street wager to a legal pokerAct.
 * `chipLabel` is the intended total street wager (raise-to for RAISE, bet size for BET).
 * Additional payment locked = target − streetContribution. Never adds the call on top of the selected total.
 * Min legal raise-to / bet enforced unless the target is an all-in (max).
 */
export function pokerTrayChipAct(
  view: PokerTableView,
  chipLabel: string,
): { type: "BET" | "RAISE"; amount: string } | null {
  const legal = visiblePokerLegalActions(view);
  const raise = legal.find((action) => action.type === "RAISE");
  const bet = legal.find((action) => action.type === "BET");
  const target = Number(chipLabel);
  if (!Number.isFinite(target) || target <= 0) return null;
  if (raise) {
    const streetWager = pokerRaiseStreetWager(view);
    const bounds = pokerComposeBounds(view, "RAISE");
    const minTo = Number(bounds.min);
    const maxTo = Number(bounds.max);
    if (target <= streetWager) return null;
    if (Number.isFinite(maxTo) && maxTo > 0 && target > maxTo) return null;
    // Below min raise-to is illegal unless this is an all-in shove to max.
    if (Number.isFinite(minTo) && target < minTo && target < maxTo) return null;
    return { type: "RAISE", amount: String(target) };
  }
  if (bet) {
    // Min bet is big blind / compose bounds — not the stack-max stored on BET.amount.
    const bounds = pokerComposeBounds(view, "BET");
    const min = Number(bounds.min);
    const max = Number(bounds.max);
    if (!Number.isFinite(min) || target < min) return null;
    if (Number.isFinite(max) && max > 0 && target > max) return null;
    return { type: "BET", amount: String(target) };
  }
  return null;
}

/** Min raise-to (or min bet) face; null when unavailable. */
export function pokerTrayMinAmount(view: PokerTableView): number | null {
  const legal = visiblePokerLegalActions(view);
  const raise = legal.find((action) => action.type === "RAISE");
  if (raise) {
    const minTo = Number(pokerComposeBounds(view, "RAISE").min);
    return Number.isFinite(minTo) ? minTo : null;
  }
  const bet = legal.find((action) => action.type === "BET");
  if (bet) {
    const min = Number(pokerComposeBounds(view, "BET").min);
    return Number.isFinite(min) ? min : null;
  }
  return null;
}

/** Current street wager facing the table (raise-to must exceed this). */
export function pokerRaiseStreetWager(view: Pick<PokerTableView, "streetWager">): number {
  const n = Number(view.streetWager?.label ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Street contribution already committed by the viewer this street. */
export function pokerStreetCommitted(view: Pick<PokerTableView, "seats" | "viewerId" | "contribution">): number {
  const own = view.seats?.find((seat) => seat.userId === view.viewerId);
  const n = Number(own?.streetContribution?.label ?? "0");
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Additional jetons leaving AVAILABLE for a target street wager.
 * Does not include chips already committed on the street (blinds / prior bets).
 */
export function pokerRaiseAdditional(view: PokerTableView, targetStreetWager: number): number {
  if (!Number.isFinite(targetStreetWager) || targetStreetWager <= 0) return 0;
  const committed = pokerStreetCommitted(view);
  const additional = targetStreetWager - committed;
  return additional > 0 ? additional : 0;
}

export function pokerComposeSeed(
  view: Pick<PokerTableView, "legalActions" | "bigBlind" | "available" | "seats" | "viewerId">,
  kind: PokerComposeKind,
): string {
  return pokerComposeBounds(view, kind).min;
}

export function pokerComposeBounds(
  view: Pick<PokerTableView, "legalActions" | "bigBlind" | "available" | "seats" | "viewerId">,
  kind: PokerComposeKind,
): { min: string; max: string; minMillis: bigint; maxMillis: bigint; convention: "Raise to" | "Bet" } {
  const own = view.seats?.find((seat) => seat.userId === view.viewerId);
  const maxTo = millis(own?.streetContribution.millis) + millis(view.available.millis);
  const maxMillis = maxTo > 0n ? maxTo : millis(view.available.millis);
  if (kind === "RAISE") {
    const minMillis = millis(view.legalActions.find((action) => action.type === "RAISE")?.raiseTo?.millis ?? view.bigBlind.millis);
    return {
      min: formatJetons(minMillis),
      max: formatJetons(maxMillis),
      minMillis,
      maxMillis,
      convention: "Raise to",
    };
  }
  const minMillis = millis(view.bigBlind.millis);
  return {
    min: view.bigBlind.label,
    max: view.available.label,
    minMillis,
    maxMillis: millis(view.available.millis),
    convention: "Bet",
  };
}

export function pokerControls(view: PokerTableView): PokerControl[] {
  const controls: PokerControl[] = [];
  if (view.isOwner && view.phase === "POKER_SETUP") {
    controls.push({
      id: "startHand",
      layer: "owner",
      surface: "dock",
      label: "START HAND",
      // Always pressable in setup; server validates seated count and the UI maps the notice.
      enabled: true,
    });
  }
  if (view.isOwner && view.nextStreetLabel && !["POKER_SETUP", "SHOWDOWN", "HAND_COMPLETE"].includes(view.phase)) {
    controls.push({
      id: "dealStreet",
      layer: "owner",
      surface: "dock",
      label: view.nextStreetLabel,
      enabled: view.canDealStreet,
      hint: view.canDealStreet ? undefined : "Waiting for bets to match",
    });
  }
  if (view.isOwner && view.canAward) {
    controls.push({ id: "assignWinners", layer: "owner", surface: "dock", label: "AWARD POT", enabled: true });
  }
  if (view.isOwner && view.canNextHand) {
    controls.push({ id: "nextHand", layer: "owner", surface: "dock", label: "NEXT HAND", enabled: true });
  }
  if (view.canReorderSeats) {
    controls.push({ id: "reorderSeats", layer: "owner", surface: "menu", label: "SEAT ORDER", enabled: true });
  }
  if (view.canAddPlayer) {
    controls.push({ id: "addPlayer", layer: "owner", surface: "menu", label: "+ PLAYER", enabled: true });
  }
  if (view.canGiveJetons) {
    controls.push({ id: "giveJetons", layer: "owner", surface: "menu", label: "GIVE JETONS", enabled: true });
  }
  if (view.canSwitchGame) {
    controls.push({ id: "switchGame", layer: "owner", surface: "menu", label: "SWITCH GAME", enabled: true });
  }
  if (view.isOwner && view.canScheduleNextHand) {
    controls.push({
      id: "scheduleNextHand",
      layer: "owner",
      surface: "menu",
      label: "NEXT HAND IN 7 SECONDS",
      enabled: true,
    });
  }
  for (const action of pokerActorActions(visiblePokerLegalActions(view))) {
    controls.push({
      id: action.type.toLowerCase(),
      layer: "actor",
      surface: "dock",
      label: action.label,
      enabled: true,
    });
  }
  return controls;
}

export function pokerTurnLabel(waitingCopy: string | null): { label: string; you: boolean } | null {
  if (!waitingCopy) return null;
  if (waitingCopy === "YOUR TURN") return { label: "YOUR TURN", you: true };
  return { label: "TURN", you: false };
}

export function pokerControlIds(
  view: PokerTableView,
  layer?: PokerControlLayer,
  surface?: PokerControlSurface,
): string[] {
  return pokerControls(view)
    .filter((control) => (layer ? control.layer === layer : true))
    .filter((control) => (surface ? control.surface === surface : true))
    .map((control) => control.id);
}
