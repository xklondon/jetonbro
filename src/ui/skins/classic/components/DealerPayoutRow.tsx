"use client";

import type { BoxView } from "@/application/queries/views";
import { DealerBlackjackBoxRow } from "./DealerBlackjackBoxRow";

export function DealerPayoutRow({
  box,
  payoutEnabled,
  onSettle,
}: {
  box: BoxView;
  payoutEnabled: boolean;
  onSettle: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
}) {
  return (
    <DealerBlackjackBoxRow
      box={box}
      phase="PAYOUT"
      payoutEnabled={payoutEnabled}
      onSettle={onSettle}
    />
  );
}
