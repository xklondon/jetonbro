"use client";

import type { BoxView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";

export function FeltBox({
  box,
  selected,
  onSelect,
  bank = false,
  showOutcomes = false,
  onSettle,
}: {
  box: BoxView;
  selected?: boolean;
  onSelect?: () => void;
  bank?: boolean;
  showOutcomes?: boolean;
  onSettle?: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
}) {
  const chips = chipsFromMillis(box.bet.millis);
  const content = (
    <>
      <span className="box-name">{box.label}</span>
      <span className="amount-label">{bank ? "BET" : "BET"}</span>
      <span className="amount">{box.bet.label}</span>
      {!showOutcomes ? (
        <span className="chip-pile">
          {chips.map((chip, index) => (
            <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
              {chip.label}
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
              onClick={() => onSettle?.(action.outcome)}
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
      <button className={`box${selected ? " selected" : ""}`} type="button" onClick={onSelect}>
        {content}
      </button>
    );
  }
  return <div className="box">{content}</div>;
}
