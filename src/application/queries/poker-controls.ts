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
    secondary: [bet, allIn, fold].filter((action): action is PokerLegalActionView => Boolean(action)),
  };
}

export function pokerActorActions(legal: PokerLegalActionView[]): PokerLegalActionView[] {
  const layout = pokerActorLayout(legal);
  return [layout.primary, ...layout.secondary].filter((action): action is PokerLegalActionView => Boolean(action));
}

export function pokerTrayEnabled(view: Pick<PokerTableView, "legalActions">): boolean {
  return view.legalActions.some((action) => action.type === "BET" || action.type === "RAISE");
}

export function pokerComposeSeed(
  view: Pick<PokerTableView, "legalActions" | "bigBlind">,
  kind: PokerComposeKind,
): string {
  if (kind === "RAISE") {
    return view.legalActions.find((action) => action.type === "RAISE")?.raiseTo?.label ?? view.bigBlind.label;
  }
  return view.bigBlind.label;
}

export function pokerControls(view: PokerTableView): PokerControl[] {
  const controls: PokerControl[] = [];
  if (view.isOwner && view.phase === "POKER_SETUP") {
    controls.push({
      id: "startHand",
      layer: "owner",
      surface: "dock",
      label: "DEAL CARDS",
      enabled: view.seats.length >= 2,
    });
  }
  if (view.isOwner && view.nextStreetLabel) {
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
    controls.push({ id: "assignWinners", layer: "owner", surface: "dock", label: "ASSIGN WINNERS", enabled: true });
  }
  if (view.isOwner && view.canNextHand) {
    controls.push({ id: "nextHand", layer: "owner", surface: "dock", label: "NEXT HAND NOW", enabled: true });
    controls.push({ id: "scheduleNextHand", layer: "owner", surface: "dock", label: "NEXT HAND IN 7 SECONDS", enabled: true });
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
  for (const action of pokerActorActions(view.legalActions)) {
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
