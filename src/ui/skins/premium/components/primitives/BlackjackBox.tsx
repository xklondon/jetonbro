"use client";

import type { BoxView } from "@/application/queries/views";

/** Factual visual chip breakdown from MAIN amount — display only. */
export function chipBreakdown(amountLabel: string): number[] {
  let remaining = Math.max(0, Math.round(Number(amountLabel) || 0));
  if (remaining === 0) return [];
  const denoms = [100, 50, 25, 10, 5];
  const chips: number[] = [];
  for (const denom of denoms) {
    while (remaining >= denom) {
      chips.push(denom);
      remaining -= denom;
    }
  }
  if (remaining > 0) chips.push(remaining);
  return chips;
}

function chipClass(value: number) {
  if (value >= 100) return "is-100";
  if (value >= 50) return "is-50";
  if (value >= 25) return "is-25";
  if (value >= 10) return "is-10";
  return "is-5";
}

function StakeStack({ label }: { label: string }) {
  const chips = chipBreakdown(label);
  const total = chips.reduce((sum, value) => sum + value, 0);
  return (
    <div
      className="pm-bj-stack"
      aria-hidden="true"
      data-chip-stack="true"
      data-chip-stack-total={String(total)}
      data-chip-values={chips.join("+")}
      style={{ height: `${Math.max(52, 28 + chips.length * 10)}px` }}
    >
      {chips.map((value, index) => (
        <span
          key={`${value}-${index}`}
          className={`pm-bj-disk ${chipClass(value)}`}
          style={{ bottom: `${index * 10}px`, zIndex: index + 1 }}
          data-chip-value={String(value)}
        >
          <strong>{value}</strong>
        </span>
      ))}
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
      data-main-amount={stake}
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
