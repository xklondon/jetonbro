"use client";

import { useRef, useState, type PointerEvent } from "react";
import type { BoxView } from "@/application/queries/views";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { endPayoutDrag, movePayoutDrag, startPayoutDrag, type PayoutDragSession } from "@/ui/core/payout-gesture";

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
  available,
  locked,
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
  let hue = 0;
  for (const char of box.playerId || title) hue = (hue + char.charCodeAt(0) * 17) % 360;
  const commitment = box.isDoubled ? `Double ${box.bet.label}` : box.isSplit ? `Split ${box.bet.label}` : null;

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
      className={`ledger-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}${dragging ? " is-swiping" : ""}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
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
      <div className="ledger-main">
        <span className="ledger-player">
          <span className="ledger-avatar" style={{ background: `hsl(${hue} 42% 42%)` }} />
          <span className="ledger-id">
            <strong>{box.playerName || "Player"}</strong>
            <small>BOX {box.boxNumber}</small>
          </span>
        </span>
        <span className="ledger-bet">{box.bet.label}</span>
        <span className="ledger-meta">
          {unresolved
            ? box.insurance
              ? `INS ${box.insurance.label}`
              : available
                ? available
                : ""
            : (commitment ?? settled ?? (phase === "PLAYING" ? "In play" : box.insurance ? `INS ${box.insurance.label}` : ""))}
          {!unresolved && box.insurance && phase !== "BETTING" && !commitment && !settled ? ` · INS ${box.insurance.label}` : ""}
        </span>
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
