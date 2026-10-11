"use client";

import { useMemo, useState } from "react";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import type { BoxView } from "@/application/queries/views";
import { CasinoChipStack } from "./CasinoJeton";

const LABELS: Record<BoxOutcome, string> = {
  LOST: "Lost",
  PUSH: "Tie",
  BLACKJACK: "Blackjack",
  WON: "Win",
};

const CLASS: Record<BoxOutcome, string> = {
  LOST: "is-lost",
  PUSH: "is-tie",
  BLACKJACK: "is-bj",
  WON: "is-win",
};

function BoxSettleRow({
  box,
  enabled,
  onSettle,
}: {
  box: BoxView;
  enabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
}) {
  const [pending, setPending] = useState<BoxOutcome | null>(null);
  const settled = box.outcome ?? pending;
  const unresolved = Boolean(enabled && !box.outcome && onSettle);

  return (
    <div
      className={`pm-bj-payout-box${settled ? " is-settled" : unresolved ? " is-unresolved" : ""}`}
      data-payout-rail="row"
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      data-payout-state={settled ?? "pending"}
    >
      <div className="pm-bj-payout-box-head">
        <strong>BOX {box.boxNumber}</strong>
        <div className="pm-bj-payout-wager">
          <CasinoChipStack millis={box.bet.millis} label={box.bet.label} size="md" max={4} />
          <span>
            MAIN {box.bet.label}
            {box.isDoubled ? " · 2×" : ""}
            {box.isSplit ? " · SPLIT" : ""}
          </span>
        </div>
      </div>
      {settled ? (
        <div className={`pm-bj-payout-result ${CLASS[settled]}`} data-box-result={settled}>
          <strong>{LABELS[settled]}</strong>
          {box.returned?.label ? <em>{box.returned.label}</em> : null}
        </div>
      ) : (
        <div className="pm-bj-payout-actions" role="group" aria-label={`Settle Box ${box.boxNumber}`}>
          {PAYOUT_RAIL_ORDER.map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={`${CLASS[outcome]}${pending === outcome ? " is-selected" : ""}`}
              data-payout-action="true"
              data-outcome={outcome}
              aria-pressed={pending === outcome}
              disabled={!unresolved}
              onClick={() => {
                setPending(outcome);
                onSettle?.(outcome);
              }}
            >
              {LABELS[outcome]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Player-grouped payout overlay — one panel per player, one row per factual box. */
export function BlackjackPayoutOverlay({
  boxes,
  enabled,
  onSettle,
}: {
  boxes: BoxView[];
  enabled?: boolean;
  onSettle?: (boxId: string, outcome: BoxOutcome) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { playerId: string; playerName: string; boxes: BoxView[] }>();
    for (const box of boxes) {
      const key = box.playerId || box.playerName || box.id;
      const existing = map.get(key);
      if (existing) existing.boxes.push(box);
      else map.set(key, { playerId: key, playerName: box.playerName || "Player", boxes: [box] });
    }
    return [...map.values()];
  }, [boxes]);

  return (
    <div className="pm-bj-payout" data-bj-layout="payout" data-payout-overlay="true">
      {groups.map((group) => (
        <section
          key={group.playerId}
          className="pm-bj-payout-panel"
          data-player-group={group.playerId}
          data-player-row="true"
        >
          <header className="pm-bj-payout-panel-head">
            <strong>{group.playerName}</strong>
            <small>
              {group.boxes.length} box{group.boxes.length === 1 ? "" : "es"}
            </small>
          </header>
          {group.boxes.map((box) => (
            <BoxSettleRow
              key={box.id}
              box={box}
              enabled={enabled}
              onSettle={onSettle ? (outcome) => onSettle(box.id, outcome) : undefined}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/** @deprecated Prefer BlackjackPayoutOverlay — kept for single-box call sites/tests. */
export function BlackjackSettlementBar({
  box,
  enabled,
  onSettle,
}: {
  box: BoxView;
  enabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
}) {
  return (
    <BlackjackPayoutOverlay
      boxes={[box]}
      enabled={enabled}
      onSettle={onSettle ? (_id, outcome) => onSettle(outcome) : undefined}
    />
  );
}
