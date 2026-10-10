"use client";

import type { BoxView } from "@/application/queries/views";

function chipTone(label: string) {
  const n = Number(label);
  if (n >= 100) return "is-blue";
  if (n >= 25) return "is-green";
  if (n >= 10) return "is-blue";
  if (n > 0) return "is-red";
  return "is-green";
}

function StakeStack({ label }: { label: string }) {
  const n = Math.max(2, Math.min(4, Math.ceil(Number(label) / 25) || 2));
  return (
    <div className="pm-bj-stack" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`pm-bj-disk ${chipTone(label)}`} style={{ bottom: `${i * 7}px`, zIndex: i + 1 }} />
      ))}
      <strong className="pm-bj-disk-face">{label}</strong>
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
  const result = box.outcome;

  return (
    <button
      type="button"
      className={`pm-bj-box${selected ? " is-selected" : ""}${hasStake ? " is-staked" : " is-quiet"}`}
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      data-box-staked={hasStake ? "true" : "false"}
      onClick={onSelect}
    >
      {showPlayerName ? <span className="pm-bj-box-player">{box.playerName}</span> : null}
      <span className="pm-bj-box-label">BOX {box.boxNumber}</span>
      {hasStake ? <StakeStack label={stake} /> : <span className="pm-bj-spot" aria-hidden="true" />}
      <span className="pm-bj-main">
        <small>MAIN</small>
        <strong>{result ? result : stake}</strong>
      </span>
      {box.hand?.ranks?.length ? (
        <div className="pm-bj-cards">
          {box.hand.ranks.map((rank, index) => (
            <span key={`${box.id}-${rank}-${index}`} className="pm-card">
              {rank}
            </span>
          ))}
          {box.hand.label ? <em className="pm-bj-total">{box.hand.label}</em> : null}
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
      <span className="pm-bj-joined-medal" aria-hidden="true">
        {(name || "P").slice(0, 1).toUpperCase()}
      </span>
      <strong>{name}</strong>
      <span data-field="available">{availableLabel}</span>
    </div>
  );
}
