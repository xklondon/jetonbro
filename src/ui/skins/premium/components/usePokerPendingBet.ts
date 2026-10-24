"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokerTrayEnabled,
  pokerTrayMinAmount,
  pokerTrayChipAct,
} from "@/application/queries/poker-controls";
import type { PokerTableView } from "@/application/queries/views";

/** Accumulate tray chip faces into a pending raise-to / bet amount; Confirm submits once. */
export function usePokerPendingBet(view: PokerTableView, trayLive: boolean) {
  const [pendingChips, setPendingChips] = useState<string[]>([]);
  const trayEnabled = Boolean(trayLive && pokerTrayEnabled(view));
  const minAmount = trayEnabled ? pokerTrayMinAmount(view) : null;
  const pendingAmount = useMemo(
    () => pendingChips.reduce((sum, face) => sum + (Number(face) || 0), 0),
    [pendingChips],
  );
  const pendingLabel = pendingAmount > 0 ? String(pendingAmount) : "";
  const pendingAct =
    trayEnabled && pendingLabel ? pokerTrayChipAct(view, pendingLabel) : null;

  useEffect(() => {
    setPendingChips([]);
  }, [view.turnNumber, view.currentActorId, view.handNumber, view.phase]);

  function addChip(face: string) {
    if (!trayEnabled) return;
    setPendingChips((prev) => [...prev, face]);
  }

  function clearPending() {
    setPendingChips([]);
  }

  return {
    trayEnabled,
    minAmount,
    pendingChips,
    pendingAmount,
    pendingLabel,
    pendingAct,
    addChip,
    clearPending,
  };
}
