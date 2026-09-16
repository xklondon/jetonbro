"use client";

import { useRef, useState } from "react";
import type { BoxView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { isHorizontalPayoutGesture, payoutSwipeOutcome } from "@/ui/core/payout-gesture";

const RAIL_TITLE: Record<BoxOutcome, string> = {
  LOST: "LOST",
  PUSH: "STAND OFF",
  BLACKJACK: "BLACKJACK",
  WON: "WON",
};

export function DealerPayoutRow({
  box,
  payoutEnabled,
  onSettle,
}: {
  box: BoxView;
  payoutEnabled: boolean;
  onSettle: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
}) {
  const [dx, setDx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);
  const locking = useRef(false);
  const chips = chipsFromMillis(box.bet.millis);
  const winAction = box.payoutActions.find((action) => action.outcome === "WON");
  const lossAction = box.payoutActions.find((action) => action.outcome === "LOST");
  const unresolved = payoutEnabled && !box.outcome && !submitted;
  const railActions = PAYOUT_RAIL_ORDER.map(
    (outcome) => box.payoutActions.find((action) => action.outcome === outcome) ?? { outcome, label: RAIL_TITLE[outcome], title: RAIL_TITLE[outcome] },
  );

  function settle(outcome: BoxView["payoutActions"][number]["outcome"]) {
    if (!unresolved) return;
    setSubmitted(true);
    onSettle(outcome);
  }

  return (
    <div
      className={`payout-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${locking.current ? " is-swiping" : ""}`}
      data-box-id={box.id}
      data-payout-row="true"
    >
      <div className="payout-swipe">
        {unresolved ? (
          <>
            <div className="payout-reveal win" aria-hidden="true">
              {winAction?.swipeLabel ?? "WIN"}
            </div>
            <div className="payout-reveal loss" aria-hidden="true">
              {lossAction?.swipeLabel ?? "LOSS · 0"}
            </div>
          </>
        ) : null}
        <div
          className="payout-row-inner"
        style={{ transform: unresolved && dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={(event) => {
          if (!unresolved) return;
          origin.current = { x: event.clientX, y: event.clientY };
          locking.current = false;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!origin.current || !unresolved) return;
          const nextDx = event.clientX - origin.current.x;
          const nextDy = event.clientY - origin.current.y;
          if (isHorizontalPayoutGesture(nextDx, nextDy)) {
            locking.current = true;
            setDx(Math.max(-120, Math.min(120, nextDx)));
          }
        }}
        onPointerUp={(event) => {
          if (!origin.current || !unresolved) {
            origin.current = null;
            return;
          }
          const nextDx = event.clientX - origin.current.x;
          const nextDy = event.clientY - origin.current.y;
          origin.current = null;
          const outcome = payoutSwipeOutcome(nextDx, nextDy);
          setDx(0);
          locking.current = false;
          if (outcome) {
            settle(outcome);
            return;
          }
          const now = Date.now();
          if (now - lastTap.current < 320) {
            lastTap.current = 0;
            settle("PUSH");
            return;
          }
          lastTap.current = now;
        }}
        onPointerCancel={() => {
          origin.current = null;
          locking.current = false;
          setDx(0);
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
          {box.outcome
            ? `${box.outcome === "WON" ? "Won" : box.outcome === "PUSH" ? "Stand off" : box.outcome === "LOST" ? "Lost" : "Blackjack"}${box.returned ? ` · ${box.returned.label}` : ""}`
            : "Unresolved"}
          {box.insurance ? <div className="muted">Insurance {box.insurance.label}</div> : null}
          {box.insuranceResult ? <div className="muted">{box.insuranceResult}</div> : null}
        </div>
      </div>
      </div>
      {unresolved ? (
        <div className="payout-access" role="group" aria-label={`Settle ${box.label}`}>
          {railActions.map((action) => (
            <button
              key={action.outcome}
              type="button"
              className={action.outcome.toLowerCase()}
              onClick={() => settle(action.outcome)}
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
