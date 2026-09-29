"use client";

import type { BoxView } from "@/application/queries/views";
import { DealerBlackjackBoxRow } from "./DealerBlackjackBoxRow";

export function DealerPayoutRow({
  box,
  payoutEnabled,
  onSettle,
  cardAssist,
}: {
  box: BoxView;
  payoutEnabled: boolean;
  onSettle: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
}) {
  return (
    <DealerBlackjackBoxRow
      box={box}
      phase="PAYOUT"
      payoutEnabled={payoutEnabled}
      onSettle={onSettle}
      cardAssist={cardAssist}
    />
  );
}
