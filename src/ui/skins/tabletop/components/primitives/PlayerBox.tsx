"use client";

import type { KeyboardEvent, ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { HandTiles } from "./HandCards";
import { ChipStack } from "./Jeton";

function resultCopy(box: BoxView): { kind: string; text: string } | null {
  if (!box.outcome) return null;
  if (box.outcome === "WON") return { kind: "won", text: box.returned ? `WON +${box.returned.label}` : "WON" };
  if (box.outcome === "LOST") return { kind: "lost", text: box.returned && box.returned.label !== "0" ? `LOST ${box.returned.label}` : "LOST" };
  if (box.outcome === "PUSH") return { kind: "push", text: box.returned ? `STAND OFF ${box.returned.label}` : "STAND OFF" };
  return { kind: "blackjack", text: box.returned ? `BLACKJACK +${box.returned.label}` : "BLACKJACK" };
}

function insuranceCopy(result: string | null): string | null {
  if (!result) return null;
  if (/LOST/i.test(result)) return "INS LOST";
  if (/WON/i.test(result)) {
    const returned = result.match(/return ([0-9.]+)/)?.[1];
    return returned ? `INS WON +${returned}` : "INS WON";
  }
  return result;
}

/** Player betting box — gold inlay, chip focus, selected depth (approved PNG silhouette). */
export function PlayerBox({
  box,
  selected = false,
  dropHighlight = false,
  empty = false,
  onSelect,
  status,
  insurancePanel,
  showCards = false,
}: {
  box?: BoxView;
  selected?: boolean;
  dropHighlight?: boolean;
  empty?: boolean;
  onSelect?: () => void;
  status?: string | null;
  insurancePanel?: ReactNode;
  showCards?: boolean;
}) {
  if (empty || !box) {
    return (
      <div className="tt-box-wrap" data-slot="1">
        <div className="tt-pbox is-empty" data-empty-slot={1} data-box-slot={1} aria-hidden="true">
          <span className="tt-pbox-name">BOX 1</span>
          <span className="tt-pbox-stake">0</span>
        </div>
      </div>
    );
  }

  const result = resultCopy(box);
  const isSelected = selected;
  const commitment = result ? null : box.isDoubled ? "2×" : box.isSplit ? "Split" : status ?? null;
  const insured = box.insurance || box.insuranceResult;
  const cardsVisible = showCards || Boolean(box.hand?.ranks?.length) || Boolean(result);

  function onKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!onSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <div className="tt-box-wrap" data-slot={box.boxNumber}>
      <div
        className={`tt-pbox${isSelected ? " is-selected" : ""}${dropHighlight ? " is-drop" : ""}${result ? ` is-${result.kind} is-payout` : ""}`}
        data-drop-box={box.id}
        data-box-id={box.id}
        data-box-slot={box.boxNumber}
        data-payout-box={result ? "true" : undefined}
        role={onSelect ? "button" : undefined}
        aria-label={box.label}
        aria-pressed={onSelect ? isSelected : undefined}
        tabIndex={onSelect ? 0 : undefined}
        onClick={onSelect}
        onKeyDown={onSelect ? onKey : undefined}
      >
        <span className="tt-pbox-inlay" aria-hidden="true" />
        <span className="tt-pbox-name">BOX {box.boxNumber}</span>
        {result ? (
          <span className="tt-pbox-payout" data-payout-main="true">
            <strong className="tt-pbox-stake">{box.returned?.label ?? box.bet.label}</strong>
            <em className={`tt-pbox-result is-${result.kind}`} data-payout-state={box.outcome ?? ""}>
              {result.text}
            </em>
          </span>
        ) : (
          <>
            <ChipStack millis={box.bet.millis} />
            <span className="tt-pbox-stake">
              {box.bet.label}
              {box.isDoubled ? <em className="tt-pbox-2x"> 2×</em> : null}
            </span>
          </>
        )}
        {insured ? (
          <span className="tt-pbox-ins" data-payout-insurance={box.insuranceResult ? "true" : undefined} data-insurance-result={box.insuranceResult ?? ""}>
            INS {box.insurance?.label ?? "—"}
            {box.insuranceResult ? ` · ${insuranceCopy(box.insuranceResult)}` : ""}
          </span>
        ) : null}
        {cardsVisible ? <HandTiles hand={box.hand} emptyLabel="" /> : null}
        {commitment ? <span className="tt-pbox-status">{commitment}</span> : null}
      </div>
      {insurancePanel}
    </div>
  );
}
