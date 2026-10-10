"use client";

import type { BoxView } from "@/application/queries/views";

function chipTone(label: string) {
  const n = Number(label);
  if (n >= 100) return "is-blue";
  if (n >= 25) return "";
  if (n >= 10) return "is-blue";
  if (n > 0) return "is-red";
  return "";
}

export function BlackjackBox({
  box,
  selected,
  showPlayerName,
  empty,
  onSelect,
}: {
  box?: BoxView;
  selected?: boolean;
  showPlayerName?: boolean;
  empty?: boolean;
  onSelect?: () => void;
}) {
  if (empty || !box) {
    return (
      <div className="pm-bj-box is-empty" data-box-stage-slot="empty">
        <span className="pm-bj-box-label">BOX</span>
        <span className="pm-bj-chip">—</span>
        <span className="pm-bj-stake">
          <small>MAIN</small>0
        </span>
      </div>
    );
  }

  const stake = box.bet.label;
  const hasStake = stake !== "0";
  return (
    <button
      type="button"
      className={`pm-bj-box${selected ? " is-selected" : ""}`}
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      onClick={onSelect}
    >
      {showPlayerName ? <span className="pm-bj-box-name">{box.playerName}</span> : null}
      <span className="pm-bj-box-label">BOX {box.boxNumber}</span>
      <span className={`pm-bj-chip ${chipTone(stake)}`}>{hasStake ? stake : "0"}</span>
      <span className="pm-bj-stake">
        <small>MAIN</small>
        {stake}
      </span>
      {box.hand?.ranks?.length ? (
        <div className="pm-bj-dealer-cards">
          {box.hand.ranks.map((rank, index) => (
            <span key={`${box.id}-${rank}-${index}`} className="pm-card">
              {rank}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export function JoinedBettingMark({
  name,
  availableLabel,
}: {
  name: string;
  availableLabel: string;
}) {
  return (
    <div className="pm-bj-joined" data-joined-player="true" data-status="PLAYER_JOINED">
      <span className="pm-bj-chip" aria-hidden="true">
        {(name || "P").slice(0, 1).toUpperCase()}
      </span>
      <strong className="pm-bj-joined-name">{name}</strong>
      <span data-field="available">{availableLabel} jetons</span>
      <span className="pm-bj-joined-badge">PLAYER JOINED</span>
    </div>
  );
}
