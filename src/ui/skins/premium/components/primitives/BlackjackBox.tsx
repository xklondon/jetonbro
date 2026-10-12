"use client";

import type { KeyboardEvent } from "react";
import type { BoxView } from "@/application/queries/views";
import { CasinoChipStack } from "./CasinoJeton";

/** @deprecated Prefer CasinoChipStack + domain millis; kept for focused unit coverage. */
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

export function BlackjackBox({
  box,
  selected,
  showPlayerName,
  onSelect,
  onRetractChip,
  retractBusy,
  onInsurance,
  insuranceEnabled,
}: {
  box: BoxView;
  selected?: boolean;
  showPlayerName?: boolean;
  onSelect?: () => void;
  onRetractChip?: (amountLabel: string) => void;
  retractBusy?: boolean;
  /** Place insurance for this box via existing buyInsurance command. */
  onInsurance?: () => void;
  insuranceEnabled?: boolean;
}) {
  const stake = box.bet.label;
  const hasStake = stake !== "0";
  const result = box.outcome;
  const insurance = box.insurance && box.insurance.label !== "0" ? box.insurance : null;
  const showInsure = Boolean(onInsurance) && !result;

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      className={`pm-bj-box${selected ? " is-selected" : ""}${hasStake ? " is-staked" : " is-quiet"}`}
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      data-box-staked={hasStake ? "true" : "false"}
      data-main-amount={stake}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? Boolean(selected) : undefined}
      aria-label={`Box ${box.boxNumber}${box.playerName ? ` · ${box.playerName}` : ""}`}
      onClick={onSelect}
      onKeyDown={onSelect ? onKey : undefined}
    >
      {showPlayerName || box.playerName ? (
        <span className="pm-bj-box-player">{box.playerName || "Player"}</span>
      ) : null}
      <span className="pm-bj-box-label">BOX {box.boxNumber}</span>
      {hasStake ? (
        <div className="pm-bj-box-stakes">
          <CasinoChipStack
            millis={box.bet.millis}
            label={stake}
            size="xl"
            onRetractChip={result ? undefined : onRetractChip}
            retractBusy={retractBusy}
          />
          {insurance ? (
            <div className="pm-bj-ins-stake" data-insurance-stake="true">
              <CasinoChipStack millis={insurance.millis} label={insurance.label} size="md" max={3} />
              <small>INS {insurance.label}</small>
            </div>
          ) : null}
        </div>
      ) : (
        <span className="pm-bj-spot" aria-hidden="true" />
      )}
      <span className="pm-bj-main">
        <small>MAIN</small>
        <strong>{result ? result : stake}</strong>
      </span>
      {showInsure ? (
        <button
          type="button"
          className="pm-bj-box-insure"
          data-player-action="insurance"
          data-insurance-panel="true"
          data-for-box={box.id}
          disabled={!insuranceEnabled || Boolean(insurance)}
          onClick={(event) => {
            event.stopPropagation();
            if (insuranceEnabled && !insurance) onInsurance?.();
          }}
        >
          {insurance ? "INS PLACED" : "INSURANCE"}
          {!insurance && box.insuranceMax?.label && box.insuranceMax.label !== "0" ? (
            <small>MAX {box.insuranceMax.label}</small>
          ) : null}
        </button>
      ) : null}
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
    </div>
  );
}

/** Empty display box for a joined player during TABLE_SETUP (no factual box yet). */
export function setupSeatBox(player: {
  userId: string;
  name: string;
  available: { millis: string; label: string };
}, boxNumber: number): BoxView {
  return {
    id: `setup-seat-${player.userId}`,
    playerId: player.userId,
    playerName: player.name,
    label: `Box ${boxNumber}`,
    boxNumber,
    bet: { millis: "0", label: "0" },
    originalStake: { millis: "0", label: "0" },
    isDoubled: false,
    isSplit: false,
    insurance: null,
    insuranceMax: { millis: "0", label: "0" },
    insuranceResult: null,
    outcome: null,
    returned: null,
    payoutActions: [],
  };
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
      <strong>{name}</strong>
      <span data-field="available">{availableLabel}</span>
    </div>
  );
}
