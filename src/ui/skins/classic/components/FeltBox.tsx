"use client";

import type { BoxView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";
import { PlayingCard } from "./PlayingCard";

export function FeltBox({
  box,
  selected,
  onSelect,
  bank = false,
  showOutcomes = false,
  onSettle,
  retractable = false,
  onRetractChip,
  dropHighlight = false,
}: {
  box: BoxView;
  selected?: boolean;
  onSelect?: () => void;
  bank?: boolean;
  showOutcomes?: boolean;
  onSettle?: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
  retractable?: boolean;
  onRetractChip?: (amount: string) => void;
  dropHighlight?: boolean;
}) {
  const chips = chipsFromMillis(box.bet.millis);
  const className = `box${selected ? " selected" : ""}${dropHighlight ? " drop-target" : ""}`;
  const content = (
    <>
      <span className="box-name">{box.label}</span>
      <span className="amount-label">BET</span>
      <span className="amount">{box.bet.label}</span>
      {box.hand?.ranks.length ? (
        <span className="box-cards" data-box-cards="true">
          {box.hand.ranks.map((rank, index) => (
            <PlayingCard key={`${rank}-${index}`} rank={rank} size="box" />
          ))}
        </span>
      ) : null}
      {!showOutcomes ? (
        <span className="chip-pile">
          {chips.map((chip, index) => (
            <span key={`${chip.label}-${index}`} className={`chip-slot${chip.exact ? " is-exact" : ""}`}>
              <span className={`chip ${chip.className}${chip.exact ? "" : ""}`}>{chip.label}</span>
              {retractable ? (
                <button
                  type="button"
                  className="chip-retract"
                  aria-label={`Retract ${chip.label} jetons from Box ${box.boxNumber}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetractChip?.(chip.amount);
                  }}
                >
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </span>
      ) : null}
      {box.insurance ? <span className="hint">Insurance {box.insurance.label}</span> : null}
      {box.isDoubled ? <span className="hint">Doubled</span> : null}
      {box.outcome && box.returned ? (
        <span className="result">
          {box.outcome === "WON"
            ? "Won"
            : box.outcome === "PUSH"
              ? "Push"
              : box.outcome === "LOST"
                ? "Lost"
                : "Blackjack"}{" "}
          · return {box.returned.label}
        </span>
      ) : null}
      {box.insuranceResult ? <span className="result">{box.insuranceResult}</span> : null}
      {!box.outcome && !bank ? <span className="hint">{selected ? "Selected" : "Tap to select"}</span> : null}
      {showOutcomes && !box.outcome ? (
        <span className="outcome">
          {box.payoutActions.map((action) => (
            <button
              key={action.outcome}
              type="button"
              className={action.outcome.toLowerCase()}
              onClick={(event) => {
                event.stopPropagation();
                onSettle?.(action.outcome);
              }}
            >
              {action.label}
            </button>
          ))}
        </span>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <div
        className={className}
        data-drop-box={box.id}
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
      >
        {content}
      </div>
    );
  }
  return (
    <div className={className} data-drop-box={box.id}>
      {content}
    </div>
  );
}
