"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import type { BoxView } from "@/application/queries/views";

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

function OutcomeIcon({ outcome }: { outcome: BoxOutcome }) {
  if (outcome === "LOST") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" fill="#7a2430" stroke="#1a1208" strokeWidth="2" />
        <path d="M11 11l10 10M21 11L11 21" stroke="#f4ead5" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (outcome === "PUSH") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="4" y="12" width="24" height="8" rx="2" fill="#efe2c4" stroke="#1a1208" strokeWidth="2" />
        <path d="M10 16h12" stroke="#1a1208" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (outcome === "BLACKJACK") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="5" y="6" width="14" height="18" rx="2" fill="#f4ead5" stroke="#1a1208" strokeWidth="1.6" transform="rotate(-12 12 15)" />
        <text x="9" y="17" fontSize="7" fontWeight="700" fill="#8b1e1e">
          A♥
        </text>
        <rect x="13" y="8" width="14" height="18" rx="2" fill="#f4ead5" stroke="#1a1208" strokeWidth="1.6" transform="rotate(10 20 17)" />
        <text x="17" y="19" fontSize="7" fontWeight="700" fill="#1a1208">
          J♠
        </text>
      </svg>
    );
  }
  return (
    <svg className="pm-outcome-icon" viewBox="0 0 32 32" aria-hidden="true">
      <polygon points="16,3 19,12 29,12 21,18 24,28 16,22 8,28 11,18 3,12 13,12" fill="#f0d78a" stroke="#1a1208" strokeWidth="1.5" />
      <rect x="7" y="14" width="18" height="8" rx="1.5" fill="#c0392b" stroke="#1a1208" strokeWidth="1.4" />
      <text x="16" y="20" textAnchor="middle" fontSize="6" fontWeight="800" fill="#1a1208">
        WIN
      </text>
    </svg>
  );
}

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
        <span data-field="main-bet">
          MAIN BET {box.bet.label}
          {box.isDoubled ? " · 2×" : ""}
          {box.isSplit ? " · SPLIT" : ""}
        </span>
      </div>
      {settled ? (
        <div className={`pm-bj-payout-result ${CLASS[settled]}`} data-box-result={settled}>
          <OutcomeIcon outcome={settled} />
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
              aria-label={`Set Box ${box.boxNumber} result: ${LABELS[outcome]}`}
              aria-pressed={pending === outcome}
              disabled={!unresolved}
              onClick={() => {
                setPending(outcome);
                onSettle?.(outcome);
              }}
            >
              <OutcomeIcon outcome={outcome} />
              <span>{LABELS[outcome]}</span>
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
          {groups.length > 1 ? (
            <header className="pm-bj-payout-panel-head">
              <strong>{group.playerName}</strong>
            </header>
          ) : null}
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
}): ReactNode {
  return (
    <BlackjackPayoutOverlay
      boxes={[box]}
      enabled={enabled}
      onSettle={onSettle ? (_id, outcome) => onSettle(outcome) : undefined}
    />
  );
}
