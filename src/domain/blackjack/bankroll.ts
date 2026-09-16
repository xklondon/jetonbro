import type { BlackjackPayoutRule } from "./payouts";
import { blackjackWinningsMillis, insuranceProfitMillis } from "./payouts";
import type { JetonMillis } from "../money";

export const BANK_FUNDING_MODES = ["OPEN", "LIMITED"] as const;
export type BankFundingMode = (typeof BANK_FUNDING_MODES)[number];

export const CARD_ASSIST_MODES = ["OFF", "CONFIRM", "AUTO"] as const;
export type CardAssistMode = (typeof CARD_ASSIST_MODES)[number];

export const DEFAULT_STARTING_BANK = "500";

/** Maximum Bank profit liability for a box stake. */
export function boxProfitExposureMillis(stake: JetonMillis, rule: BlackjackPayoutRule): JetonMillis {
  return blackjackWinningsMillis(stake, rule);
}

/** Insurance 2:1 profit exposure. */
export function insuranceProfitExposureMillis(insuranceStake: JetonMillis): JetonMillis {
  return insuranceProfitMillis(insuranceStake, "DEALER_BLACKJACK");
}

export function additionalExposureMillis(
  currentReserved: JetonMillis,
  nextStake: JetonMillis,
  rule: BlackjackPayoutRule,
): JetonMillis {
  const needed = boxProfitExposureMillis(nextStake, rule);
  return needed - currentReserved;
}
