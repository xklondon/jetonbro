"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { endPayoutDrag, movePayoutDrag, startPayoutDrag, type PayoutDragSession } from "@/ui/core/payout-gesture";
import { PlayingCard } from "./PlayingCard";

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
  onApply,
  cardEntry,
}: {
  box: BoxView;
  phase: string;
  payoutEnabled?: boolean;
  onSettle?: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
  onApply?: () => void;
  cardEntry?: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const session = useRef<PayoutDragSession | null>(null);
  const lastTap = useRef(0);
  const ignoreClickUntil = useRef(0);
  const chips = chipsFromMillis(box.bet.millis);
  const unresolved = payoutEnabled && !box.outcome && !submitted && Boolean(onSettle);
  const railActions = PAYOUT_RAIL_ORDER.map(
    (outcome) => box.payoutActions.find((action) => action.outcome === outcome) ?? { outcome, label: RAIL_TITLE[outcome], title: RAIL_TITLE[outcome] },
  );
  const settled = resultCopy(box);

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

  const cards: ReactNode =
    box.hand?.ranks.length ? (
      <div className="box-cards" data-box-cards="true">
        {box.hand.ranks.map((rank, index) => (
          <PlayingCard key={`${rank}-${index}`} rank={rank} size="box" />
        ))}
      </div>
    ) : null;

  return (
    <div
      className={`payout-row blackjack-box-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}${dragging ? " is-swiping" : ""}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-box-phase={phase}
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
      <div className="payout-swipe">
        {unresolved ? (
          <>
            <div className="payout-reveal win" aria-hidden="true">
              WON
            </div>
            <div className="payout-reveal loss" aria-hidden="true">
              LOST
            </div>
          </>
        ) : null}
        <div
          className="payout-row-inner"
          style={{
            transform: unresolved && dx ? `translateX(${dx}px)` : undefined,
          }}
        >
          <div>
            <strong>{box.label}</strong>
            <div className="muted">Stake {box.bet.label}</div>
          </div>
          <span className="chip-pile compact">
            {chips.map((chip, index) => (
              <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
                {chip.label}
              </span>
            ))}
          </span>
          <div className="payout-state">
            {settled ?? (unresolved ? "Unresolved" : phase === "PLAYING" ? "In play" : phase === "BETTING" ? "Betting" : box.hand?.label || "")}
            {box.insurance ? <div className="muted">Insurance {box.insurance.label}</div> : null}
            {box.insuranceResult ? <div className="muted">{box.insuranceResult}</div> : null}
            {box.hand?.label ? <div className="muted">{box.hand.label}</div> : null}
            {box.hand?.suggestedOutcome ? (
              <div className="muted">Suggested {box.hand.suggestedOutcome === "PUSH" ? "STAND OFF" : box.hand.suggestedOutcome}</div>
            ) : null}
          </div>
        </div>
      </div>
      {cards}
      {cardEntry}
      {unresolved && onApply && box.hand?.suggestedOutcome ? (
        <button
          type="button"
          className="apply-suggestion"
          data-payout-action="true"
          onPointerDown={stopActionPointer}
          onClick={(event) => {
            event.stopPropagation();
            if (Date.now() < ignoreClickUntil.current) return;
            onApply();
          }}
        >
          APPLY {box.hand.suggestedOutcome === "PUSH" ? "STAND OFF" : box.hand.suggestedOutcome}
        </button>
      ) : null}
      {unresolved ? (
        <div className="payout-access" role="group" aria-label={`Settle ${box.label}`}>
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
              {action.returnLine ? <span className="rail-return">{action.returnLine}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
