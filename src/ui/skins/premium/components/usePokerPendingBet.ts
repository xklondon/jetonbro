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
 * RAISE compose tracks RAISE BY (increment above street wager).
 * Chip face N adds exactly N to raise-by → additional payment grows by N
 * (additional = toCall + raiseBy = raiseTo − streetContribution).
 * Confirm submits raise-to once.
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

  const pendingRaiseTo = kind === "RAISE" && amountValue > 0 ? streetWager + amountValue : amountValue;
  const pendingAdditional =
    kind === "RAISE" && amountValue > 0 ? pokerRaiseAdditional(view, amountValue) : amountValue;
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
    setAmountText("");
    setPendingChips([]);
  }

  function setAmount(next: string) {
    if (!trayEnabled || !composeOpen) return;
    const cleaned = next.replace(/[^\d]/g, "");
    setAmountText(cleaned);
    setPendingChips([]);
  }

  function addChip(face: string) {
    if (!trayEnabled) return;
    if (!composeOpen) {
      if (!kind) return;
      setComposeOpen(true);
    }
    const faceN = Number(face);
    if (!Number.isFinite(faceN) || faceN <= 0) return;
    setPendingChips((prev) => [...prev, face]);
    setAmountText((prev) => String((Number(prev) || 0) + faceN));
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
