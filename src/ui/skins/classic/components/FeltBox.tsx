"use client";

import type { ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { chipsFromMillis } from "./chips";

function resultCopy(box: BoxView): { kind: string; text: string } | null {
  if (!box.outcome) return null;
  if (box.outcome === "WON") return { kind: "won", text: box.returned ? `Won +${box.returned.label}` : "Won" };
  if (box.outcome === "LOST") return { kind: "lost", text: box.returned && box.returned.label !== "0" ? `Lost ${box.returned.label}` : "Lost" };
  if (box.outcome === "PUSH") return { kind: "push", text: box.returned ? `Stand-off ${box.returned.label}` : "Stand-off" };
  return { kind: "blackjack", text: box.returned ? `Blackjack +${box.returned.label}` : "Blackjack" };
}

export function FeltBox({
  box,
  selected,
  onSelect,
  bank = false,
  compact = false,
  showOutcomes = false,
  onSettle,
  retractable = false,
  onRetractChip,
  dropHighlight = false,
  cardEntry,
}: {
  box: BoxView;
  selected?: boolean;
  onSelect?: () => void;
  bank?: boolean;
  compact?: boolean;
  showOutcomes?: boolean;
  onSettle?: (outcome: BoxView["payoutActions"][number]["outcome"]) => void;
  retractable?: boolean;
  onRetractChip?: (amount: string) => void;
  dropHighlight?: boolean;
  cardEntry?: ReactNode;
}) {
  const chips = chipsFromMillis(box.bet.millis);
  const result = resultCopy(box);
  const className = `box${compact ? " is-compact" : ""}${selected ? " selected" : ""}${dropHighlight ? " drop-target" : ""}${result ? ` is-${result.kind}` : ""}`;
  const content = (
    <>
      <span className="box-name">{box.label}</span>
      <span className="amount-label">MAIN</span>
      <span className="amount">{box.bet.label}</span>
      {!showOutcomes ? (
        <span className="chip-pile">
          {chips.map((chip, index) => (
            <span key={`${chip.label}-${index}`} className={`chip-slot${chip.exact ? " is-exact" : ""}`}>
              <span className={`chip ${chip.className}`}>{chip.label}</span>
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
      {box.insurance ? <span className="hint">INSURANCE {box.insurance.label}</span> : null}
      {box.isDoubled ? <span className="hint">Doubled</span> : null}
      {result ? <span className="result">{result.text}</span> : null}
      {box.insuranceResult ? <span className="result">{box.insuranceResult}</span> : null}
      {cardEntry}
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
        data-box-id={box.id}
        data-box-slot={box.boxNumber}
        role="button"
        aria-label={box.label}
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
    <div className={className} data-drop-box={box.id} data-box-id={box.id} data-box-slot={box.boxNumber}>
      {content}
    </div>
  );
}
