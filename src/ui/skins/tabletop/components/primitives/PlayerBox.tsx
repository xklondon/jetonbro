"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { HandTiles } from "./HandCards";
import { ChipStack } from "./Jeton";
import { nextCelebrateClass } from "./result-celebrate";

function resultCopy(box: BoxView): { kind: string; text: string; label: string } | null {
  if (!box.outcome) return null;
  if (box.outcome === "WON") return { kind: "won", label: "WON", text: box.returned ? `WON +${box.returned.label}` : "WON" };
  if (box.outcome === "LOST") return { kind: "lost", label: "LOST", text: box.returned && box.returned.label !== "0" ? `LOST ${box.returned.label}` : "LOST" };
  if (box.outcome === "PUSH") return { kind: "push", label: "STAND OFF", text: box.returned ? `STAND OFF ${box.returned.label}` : "STAND OFF" };
  return { kind: "blackjack", label: "BLACKJACK", text: box.returned ? `BLACKJACK +${box.returned.label}` : "BLACKJACK" };
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

/** One-shot celebrate class when outcome newly arrives; refresh mounts stay static. */
function useResultCelebrate(boxId: string, outcome: string | null | undefined) {
  const prev = useRef<string | null | undefined>(undefined);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  useEffect(() => {
    const step = nextCelebrateClass(prev.current, outcome);
    prev.current = step.nextPrev;
    if (step.celebrate) {
      setCelebrate(step.celebrate);
      const timer = window.setTimeout(() => setCelebrate(null), 1400);
      return () => window.clearTimeout(timer);
    }
    if (!outcome) setCelebrate(null);
  }, [boxId, outcome]);

  return celebrate;
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
  const celebrate = useResultCelebrate(box?.id ?? "empty", box?.outcome);

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
        className={`tt-pbox${isSelected ? " is-selected" : ""}${dropHighlight ? " is-drop" : ""}${result ? ` is-${result.kind} is-payout` : ""}${celebrate ? ` ${celebrate}` : ""}`}
        data-drop-box={box.id}
        data-box-id={box.id}
        data-box-slot={box.boxNumber}
        data-payout-box={result ? "true" : undefined}
        data-result-celebrate={celebrate ? "true" : undefined}
        data-celebrate-kind={celebrate ? result?.kind : undefined}
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
            <em className={`tt-pbox-result is-${result.kind}`} data-payout-state={box.outcome ?? ""}>
              {result.label}
            </em>
            <strong className="tt-pbox-stake">{box.returned?.label ?? box.bet.label}</strong>
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
