"use client";

import type { ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { BettingPlaque } from "./BettingPlaque";
import { chipsFromMillis } from "./chips";

function resultCopy(box: BoxView): { kind: string; text: string } | null {
  if (!box.outcome) return null;
  if (box.outcome === "WON") return { kind: "won", text: box.returned ? `Won +${box.returned.label}` : "Won" };
  if (box.outcome === "LOST") return { kind: "lost", text: box.returned && box.returned.label !== "0" ? `Lost ${box.returned.label}` : "Lost" };
  if (box.outcome === "PUSH") return { kind: "push", text: box.returned ? `Stand-off ${box.returned.label}` : "Stand-off" };
  return { kind: "blackjack", text: box.returned ? `Blackjack +${box.returned.label}` : "Blackjack" };
}

function insuranceState(result: string | null): string | null {
  if (!result) return null;
  if (/LOST/i.test(result)) return "INSURANCE LOST";
  if (/WON/i.test(result)) {
    const returned = result.match(/return ([0-9.]+)/)?.[1];
    return returned ? `Won +${returned}` : "Won";
  }
  return result;
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
  status,
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
  status?: string;
}) {
  const chips = chipsFromMillis(box.bet.millis);
  const result = resultCopy(box);
  const payout = Boolean(result || box.insuranceResult);
  const yours = /^YOUR BOX/i.test(box.label);
  const className = `box${compact ? " is-compact" : ""}${selected ? " selected" : ""}${dropHighlight ? " drop-target" : ""}${result ? ` is-${result.kind}` : ""}${payout ? " is-payout" : ""}`;
  const statusText = result
    ? result.kind === "won"
      ? "Won"
      : result.kind === "lost"
        ? "Lost"
        : result.kind === "push"
          ? "Stand-off"
          : "Blackjack"
    : box.isDoubled
      ? "Doubled"
      : status;
  const content = (
    <>
      <BettingPlaque />
      <span className="box-head">
        <strong className="box-name">BOX {box.boxNumber}</strong>
        {yours ? <small className="box-kicker">YOUR BOX</small> : null}
      </span>
      {payout ? (
        <div className="box-payout-line" data-payout-main="true">
          <strong className="amount">{box.returned?.label ?? box.bet.label}</strong>
          {result ? (
            <span className={`payout-state is-${result.kind}`} data-payout-state={box.outcome ?? ""}>
              {result.text}
            </span>
          ) : null}
        </div>
      ) : (
        <div className="box-stake">
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
          <span className="amount">{box.bet.label}</span>
        </div>
      )}
      {box.insurance || box.insuranceResult ? (
        <span className="box-ins" data-payout-insurance={box.insuranceResult ? "true" : undefined} data-insurance-result={box.insuranceResult ?? ""}>
          INS {box.insurance?.label ?? "—"}
          {box.insuranceResult ? ` · ${insuranceState(box.insuranceResult)}` : ""}
        </span>
      ) : null}
      {statusText ? <span className="box-status">{statusText}</span> : null}
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
        data-payout-box={payout ? "true" : undefined}
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
    <div
      className={className}
      data-drop-box={box.id}
      data-box-id={box.id}
      data-box-slot={box.boxNumber}
      data-payout-box={payout ? "true" : undefined}
    >
      {content}
    </div>
  );
}
