import { formatJetons, type JetonMillis } from "../money";

export const POKER_ACTION_TYPES = ["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"] as const;
export type PokerActionType = (typeof POKER_ACTION_TYPES)[number];

export type LegalPokerAction = {
  type: PokerActionType;
  amountMillis: JetonMillis;
  raiseToMillis?: JetonMillis;
  label: string;
};

export type ActionContext = {
  isActor: boolean;
  status: "ACTIVE" | "FOLDED" | "ALL_IN";
  streetContributionMillis: JetonMillis;
  streetWagerMillis: JetonMillis;
  availableMillis: JetonMillis;
  lastRaiseSizeMillis: JetonMillis;
};

export function amountToCall(streetWager: JetonMillis, streetContribution: JetonMillis): JetonMillis {
  return streetWager > streetContribution ? streetWager - streetContribution : 0n;
}

export function minRaiseTo(streetWager: JetonMillis, lastRaiseSize: JetonMillis): JetonMillis {
  const increment = lastRaiseSize > 0n ? lastRaiseSize : 0n;
  return streetWager + increment;
}

export function isFullRaise(raiseTo: JetonMillis, streetWager: JetonMillis, lastRaiseSize: JetonMillis): boolean {
  return raiseTo - streetWager >= (lastRaiseSize > 0n ? lastRaiseSize : 0n) && raiseTo > streetWager;
}

export function legalActions(ctx: ActionContext): LegalPokerAction[] {
  if (!ctx.isActor || ctx.status !== "ACTIVE") return [];
  const owed = amountToCall(ctx.streetWagerMillis, ctx.streetContributionMillis);
  const stack = ctx.availableMillis;
  const actions: LegalPokerAction[] = [
    { type: "FOLD", amountMillis: 0n, label: "FOLD" },
  ];
  if (owed === 0n) {
    actions.push({ type: "CHECK", amountMillis: 0n, label: "CHECK" });
    if (stack > 0n && ctx.streetWagerMillis === 0n) {
      actions.push({ type: "BET", amountMillis: stack, label: "BET" });
    } else if (stack > 0n) {
      const raiseTo = minRaiseTo(ctx.streetWagerMillis, ctx.lastRaiseSizeMillis);
      const maxTo = ctx.streetContributionMillis + stack;
      actions.push({
        type: "RAISE",
        amountMillis: maxTo - ctx.streetContributionMillis,
        raiseToMillis: raiseTo < maxTo ? raiseTo : maxTo,
        label: "RAISE",
      });
    }
    if (stack > 0n) actions.push({ type: "ALL_IN", amountMillis: stack, label: "ALL IN" });
    return uniqueActions(actions);
  }
  if (stack === 0n) return uniqueActions(actions);
  if (stack >= owed) {
    actions.push({ type: "CALL", amountMillis: owed, label: `CALL ${formatJetons(owed)}` });
    if (stack > owed) {
      const raiseTo = minRaiseTo(ctx.streetWagerMillis, ctx.lastRaiseSizeMillis);
      const maxTo = ctx.streetContributionMillis + stack;
      if (maxTo > ctx.streetWagerMillis) {
        actions.push({
          type: "RAISE",
          amountMillis: maxTo - ctx.streetContributionMillis,
          raiseToMillis: raiseTo < maxTo ? raiseTo : maxTo,
          label: "RAISE",
        });
      }
    }
    actions.push({ type: "ALL_IN", amountMillis: stack, label: "ALL IN" });
    return uniqueActions(actions);
  }
  actions.push({ type: "ALL_IN", amountMillis: stack, label: "ALL IN" });
  return uniqueActions(actions);
}

function uniqueActions(actions: LegalPokerAction[]): LegalPokerAction[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.type}:${action.amountMillis.toString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canCheck(ctx: ActionContext): boolean {
  return amountToCall(ctx.streetWagerMillis, ctx.streetContributionMillis) === 0n;
}
