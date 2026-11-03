"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokerComposeBounds,
  pokerRaiseAdditional,
  pokerRaiseStreetWager,
  pokerStreetCommitted,
  pokerTrayEnabled,
  pokerTrayMinAmount,
  pokerTrayChipAct,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
import type { PokerTableView } from "@/application/queries/views";

/**
 * Compose tracks the intended total street wager (raise-to / bet).
 * Chip faces accumulate toward that total; the additional debit is
 * target − streetContribution (never call + selected face).
 * Confirm submits raise-to / bet once.
 */
export function usePokerPendingBet(view: PokerTableView, trayLive: boolean) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [pendingChips, setPendingChips] = useState<string[]>([]);

  const trayEnabled = Boolean(trayLive && pokerTrayEnabled(view));
  const legal = visiblePokerLegalActions(view);
  const raise = legal.find((action) => action.type === "RAISE");
  const bet = legal.find((action) => action.type === "BET");
  const kind: "RAISE" | "BET" | null = raise ? "RAISE" : bet ? "BET" : null;
  const bounds = kind ? pokerComposeBounds(view, kind) : null;
  const minAmount = trayEnabled ? pokerTrayMinAmount(view) : null;
  const maxAmount = bounds ? Number(bounds.max) : null;
  const toCallLabel = view.toCall?.label && view.toCall.label !== "0" ? view.toCall.label : null;
  const streetWager = pokerRaiseStreetWager(view);
  const committed = pokerStreetCommitted(view);

  const amountValue = useMemo(() => {
    const n = Number(amountText);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [amountText]);

  /** Target total street wager (raise-to or bet). */
  const pendingRaiseTo = amountValue;
  const pendingAdditional = amountValue > 0 ? pokerRaiseAdditional(view, amountValue) : 0;
  /** Felt pending stack = additional leaving AVAILABLE (never re-shows committed blinds). */
  const pendingLabel = pendingAdditional > 0 ? String(pendingAdditional) : "";
  const pendingAct =
    trayEnabled && composeOpen && amountValue > 0 ? pokerTrayChipAct(view, String(amountValue)) : null;

  useEffect(() => {
    setComposeOpen(false);
    setAmountText("");
    setPendingChips([]);
  }, [view.turnNumber, view.currentActorId, view.handNumber, view.phase]);

  function openCompose() {
    if (!trayEnabled || !kind) return;
    setComposeOpen(true);
    // Empty total — placeholder shows min. First chip sets the total; further chips accumulate.
    setAmountText("");
    setPendingChips([]);
  }

  function setAmount(next: string) {
    if (!trayEnabled || !composeOpen) return;
    const cleaned = next.replace(/[^\d]/g, "");
    setAmountText(cleaned);
    setPendingChips([]);
  }

  /**
   * Chip faces build the intended total street wager.
   * First tap sets the total to that face; later taps accumulate.
   * Never adds the call amount on top of the selected face.
   */
  function addChip(face: string) {
    if (!trayEnabled) return;
    if (!composeOpen) {
      if (!kind) return;
      setComposeOpen(true);
    }
    const faceN = Number(face);
    if (!Number.isFinite(faceN) || faceN <= 0) return;
    setPendingChips((prev) => [...prev, face]);
    setAmountText((prev) => {
      const current = Number(prev) || 0;
      return String(current <= 0 ? faceN : current + faceN);
    });
  }

  function clearPending() {
    setComposeOpen(false);
    setAmountText("");
    setPendingChips([]);
  }

  return {
    trayEnabled,
    composeOpen,
    composeKind: kind,
    minAmount,
    maxAmount,
    toCallLabel,
    streetWager,
    committed,
    amountText,
    pendingChips,
    pendingAmount: amountValue,
    pendingAdditional,
    pendingRaiseTo,
    pendingLabel,
    pendingAct,
    openCompose,
    setAmount,
    addChip,
    clearPending,
  };
}
