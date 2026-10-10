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

/** Compact physical stack — display focus of a staked box. */
function StakeStack({ label }: { label: string }) {
  const n = Math.max(1, Math.min(4, Math.ceil(Number(label) / 25) || 1));
  return (
    <div className="pm-bj-stack" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`pm-bj-stack-chip ${chipTone(label)}`} style={{ zIndex: n - i }} />
      ))}
      <strong className="pm-bj-stack-face">{label}</strong>
    </div>
  );
}

export function BlackjackBox({
  box,
  selected,
  showPlayerName,
  onSelect,
}: {
  box: BoxView;
  selected?: boolean;
  showPlayerName?: boolean;
  onSelect?: () => void;
}) {
  const stake = box.bet.label;
  const hasStake = stake !== "0";
  return (
    <button
      type="button"
      className={`pm-bj-box${selected ? " is-selected" : ""}${hasStake ? "" : " is-quiet"}`}
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      data-box-staked={hasStake ? "true" : "false"}
      onClick={onSelect}
    >
      {showPlayerName ? <span className="pm-bj-box-name">{box.playerName}</span> : null}
      <span className="pm-bj-box-label">BOX {box.boxNumber}</span>
      {hasStake ? <StakeStack label={stake} /> : <span className="pm-bj-spot" aria-hidden="true" />}
      <span className="pm-bj-stake">
        <small>MAIN</small>
        {stake}
      </span>
      {box.hand?.ranks?.length ? (
        <div className="pm-bj-box-cards">
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

/** Compact joined-player marker for TABLE SETUP only. */
export function JoinedBettingMark({
  name,
  availableLabel,
}: {
  name: string;
  availableLabel: string;
}) {
  return (
    <div className="pm-bj-joined" data-joined-player="true" data-status="PLAYER_JOINED">
      <span className="pm-bj-joined-medal" aria-hidden="true">
        {(name || "P").slice(0, 1).toUpperCase()}
      </span>
      <strong className="pm-bj-joined-name">{name}</strong>
      <span data-field="available">{availableLabel}</span>
    </div>
  );
}
