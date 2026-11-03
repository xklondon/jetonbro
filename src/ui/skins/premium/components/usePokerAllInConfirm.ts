"use client";

import { useEffect, useState } from "react";
import type { PokerLegalActionView } from "@/application/queries/views";

/** Two-step ALL IN: arm with amount shown, then confirm once. */
export function usePokerAllInConfirm(
  allIn: PokerLegalActionView | null,
  turnKey: string,
  onSubmit: (action: PokerLegalActionView) => void,
) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(false);
  }, [turnKey, allIn?.amount.label]);

  if (!allIn) return null;

  const amount = allIn.amount.label;
  return {
    label: armed ? `CONFIRM ALL IN ${amount}` : `ALL IN ${amount}`,
    title: armed ? `Commit ${amount} jetons (all available)` : `All in ${amount} — tap again to confirm`,
    disabled: false,
    onClick: () => {
      if (!armed) {
        setArmed(true);
        return;
      }
      setArmed(false);
      onSubmit(allIn);
    },
  };
}
