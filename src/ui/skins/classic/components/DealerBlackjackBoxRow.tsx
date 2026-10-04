"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { BoxView } from "@/application/queries/views";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { endPayoutDrag, movePayoutDrag, startPayoutDrag, type PayoutDragSession } from "@/ui/core/payout-gesture";
import { BettingPlaque } from "./BettingPlaque";
import { chipsFromMillis } from "./chips";

const RAIL_TITLE: Record<BoxOutcome, string> = {
  LOST: "LOST",
  PUSH: "STAND OFF",
  BLACKJACK: "BLACKJACK",
  WON: "WON",
};

function pointerFromEvent(event: PointerEvent<HTMLElement>, fromAction = false) {
  return {
    isPrimary: event.isPrimary,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    button: event.button,
    clientX: event.clientX,
    clientY: event.clientY,
    fromAction,
  };
}

function resultCopy(box: BoxView): string | null {
  if (!box.outcome) return null;
  const result =
    box.outcome === "WON"
      ? "Won"
      : box.outcome === "PUSH"
        ? "Stand off"
        : box.outcome === "LOST"
          ? "Lost"
          : "Blackjack";
  return box.returned ? `${result} · ${box.returned.label}` : result;
}

export function DealerBlackjackBoxRow({
  box,
  phase,
  payoutEnabled = false,
  onSettle,
}: {
  box: BoxView;
  phase: string;
  payoutEnabled?: boolean;
  available?: string;
  locked?: string;
  onSettle?: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const session = useRef<PayoutDragSession | null>(null);
  const lastTap = useRef(0);
  const ignoreClickUntil = useRef(0);
  const unresolved = payoutEnabled && !box.outcome && !submitted && Boolean(onSettle);
  const railActions = PAYOUT_RAIL_ORDER.map(
    (outcome) => box.payoutActions.find((action) => action.outcome === outcome) ?? { outcome, label: RAIL_TITLE[outcome], title: RAIL_TITLE[outcome] },
  );
  const settled = resultCopy(box);
  const title = `${box.playerName || "Player"} · BOX ${box.boxNumber}`;
  const commitment = box.isDoubled ? "Double" : box.isSplit ? "Split" : null;
  const chips = chipsFromMillis(box.bet.millis);
  const state = commitment ?? settled;
  void dx;

  function settle(outcome: BoxView["payoutActions"][number]["outcome"]) {
    if (!unresolved || !onSettle) return;
    ignoreClickUntil.current = Date.now() + 400;
    setSubmitted(true);
    onSettle(outcome);
  }

  function syncSession(next: PayoutDragSession | null) {
    session.current = next;
    setDx(next?.dx ?? 0);
    setDragging(Boolean(next?.dragging));
  }

  function onRowPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!unresolved) return;
    const fromAction = Boolean((event.target as Element | null)?.closest?.("[data-payout-action]"));
    const next = startPayoutDrag(pointerFromEvent(event, fromAction), session.current);
    if (!next) return;
    syncSession(next);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is best-effort; touch-action none while dragging keeps the row in control.
    }
  }

  function onRowPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!session.current || !unresolved) return;
    const next = movePayoutDrag(session.current, pointerFromEvent(event));
    if (next.dragging) event.preventDefault();
    syncSession(next);
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const current = session.current;
    if (!current) return;
    if (cancelled) {
      syncSession(null);
      return;
    }
    const ended = endPayoutDrag(current, pointerFromEvent(event), Date.now(), lastTap.current);
    lastTap.current = ended.lastTap;
    if (ended.ignoreClick) ignoreClickUntil.current = Date.now() + 500;
    syncSession(null);
    if (ended.outcome) settle(ended.outcome);
  }

  function stopActionPointer(event: PointerEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <div
      className={`dealer-position${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}${dragging ? " is-swiping" : ""}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-dealer-position="true"
      data-box-phase={phase}
      data-player-row="true"
      data-player-group={box.playerId}
      data-payout-row={unresolved || Boolean(box.outcome) ? "true" : undefined}
      data-payout-gesture={unresolved ? "true" : undefined}
      style={{ touchAction: unresolved ? (dragging ? "none" : "pan-y") : undefined }}
      onPointerDown={onRowPointerDown}
      onPointerMove={onRowPointerMove}
      onPointerUp={(event) => finishPointer(event, false)}
      onPointerCancel={(event) => finishPointer(event, true)}
      onClick={(event) => {
        if (Date.now() < ignoreClickUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <div className="position-spot">
        <BettingPlaque />
        <span className="position-who">
          <strong>{box.playerName || "Player"}</strong>
          <small>BOX {box.boxNumber}</small>
        </span>
        <span className="position-stake">
          {Number(box.bet.millis) > 0 ? (
            <span className="chip-pile">
              {chips.map((chip, index) => (
                <span key={`${chip.label}-${index}`} className={`chip-slot${chip.exact ? " is-exact" : ""}`}>
                  <span className={`chip ${chip.className}`}>{chip.label}</span>
                </span>
              ))}
            </span>
          ) : null}
          <strong className="amount">{box.bet.label}</strong>
          {box.insurance ? <small className="position-ins">INS {box.insurance.label}</small> : null}
        </span>
        {state ? <span className="position-state">{state}</span> : null}
      </div>
      {unresolved ? (
        <span className="outcome payout-access" role="group" aria-label={`Settle ${title}`}>
          {railActions.map((action) => (
            <button
              key={action.outcome}
              type="button"
              className={action.outcome.toLowerCase()}
              data-payout-action="true"
              onPointerDown={stopActionPointer}
              onClick={(event) => {
                event.stopPropagation();
                if (Date.now() < ignoreClickUntil.current) return;
                settle(action.outcome);
              }}
            >
              <span className="rail-title">{action.title ?? RAIL_TITLE[action.outcome]}</span>
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
