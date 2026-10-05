"use client";

import { useState, type ReactNode } from "react";
import type { BoxView, HandView } from "@/application/queries/views";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
import { BoxCardControls, HandTiles } from "./HandCards";
import { ChipStack } from "./Jeton";
import { TableButton } from "./TableButton";

const RAIL_TITLE: Record<BoxOutcome, string> = {
  LOST: "LOST",
  PUSH: "STAND OFF",
  BLACKJACK: "BLACKJACK",
  WON: "WON",
};

const RESULT_KIND: Record<BoxOutcome, "lost" | "push" | "blackjack" | "won"> = {
  LOST: "lost",
  PUSH: "push",
  BLACKJACK: "blackjack",
  WON: "won",
};

function resultCopy(box: BoxView): string | null {
  if (!box.outcome) return null;
  const result = box.outcome === "WON" ? "Won" : box.outcome === "PUSH" ? "Stand off" : box.outcome === "LOST" ? "Lost" : "Blackjack";
  return box.returned ? `${result} · ${box.returned.label}` : result;
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

/** Per-box main result controls. */
export function ResultControls({
  box,
  onSettle,
}: {
  box: BoxView;
  onSettle: (outcome: BoxOutcome) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  if (submitted || box.outcome) return null;
  const title = `${box.playerName || "Player"} · BOX ${box.boxNumber}`;
  return (
    <span className="tt-ledger-results" role="group" aria-label={`Settle ${title}`}>
      {PAYOUT_RAIL_ORDER.map((outcome) => {
        const action = box.payoutActions.find((entry) => entry.outcome === outcome);
        return (
          <TableButton
            key={outcome}
            variant="result"
            result={RESULT_KIND[outcome]}
            data-payout-action="true"
            onClick={() => {
              setSubmitted(true);
              onSettle(outcome);
            }}
          >
            {action?.title ?? RAIL_TITLE[outcome]}
          </TableButton>
        );
      })}
    </span>
  );
}

/** Dense row for one real box instance — never aggregates by Player. */
export function DealerLedgerRow({
  box,
  phase,
  payoutEnabled,
  insuranceSettleEnabled,
  onSettle,
  onSettleInsurance,
  onAddCard,
  onUndoCard,
  dealerMayCorrect,
  playerName,
  availableLabel,
  empty,
}: {
  box?: BoxView;
  phase?: string;
  payoutEnabled?: boolean;
  insuranceSettleEnabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
  onSettleInsurance?: (resolution: "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK") => void;
  onAddCard?: (boxId: string, rank: string) => void;
  onUndoCard?: (boxId: string) => void;
  dealerMayCorrect?: boolean;
  playerName?: string;
  availableLabel?: string;
  empty?: boolean;
}) {
  if (empty || !box) {
    return (
      <div className="tt-ledger-row is-idle is-empty" data-player-row="true">
        <span className="tt-ledger-who">
          <strong>{playerName || "Player"}</strong>
          <small>AVAILABLE</small>
        </span>
        <span className="tt-ledger-stake">
          <strong>{availableLabel ?? "0"}</strong>
        </span>
        <span className="tt-ledger-action">—</span>
      </div>
    );
  }

  const unresolved = Boolean(payoutEnabled && !box.outcome && onSettle);
  const settled = resultCopy(box);
  const doubled = box.isDoubled;
  const split = box.isSplit;
  const showCards = phase === "PLAYING" || phase === "PAYOUT" || phase === "ROUND_COMPLETE";
  const hand = box.hand as HandView | undefined;
  const canCorrect = Boolean(dealerMayCorrect && hand?.canEdit && onAddCard && onUndoCard);
  const showInsSettle = Boolean(insuranceSettleEnabled && box.insurance && !box.insuranceResult && onSettleInsurance);
  const insSettled = insuranceCopy(box.insuranceResult);

  return (
    <div
      className={`tt-ledger-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}${showCards ? " has-cards" : ""}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-box-phase={phase}
      data-player-row="true"
      data-player-group={box.playerId}
      data-box-number={box.boxNumber}
      data-doubled={doubled ? "true" : undefined}
      data-split={split ? "true" : undefined}
      data-payout-row={unresolved || Boolean(box.outcome) ? "true" : undefined}
    >
      <span className="tt-ledger-who">
        <strong>{box.playerName || "Player"}</strong>
        <small>
          BOX {box.boxNumber}
          {doubled ? " · 2×" : ""}
          {split ? " · SPLIT" : ""}
        </small>
      </span>
      <span className="tt-ledger-stake">
        <ChipStack millis={box.bet.millis} max={4} />
        <strong>
          {box.bet.label}
          {doubled ? <em className="tt-ledger-2x"> 2×</em> : null}
        </strong>
        {box.insurance ? <small className="tt-ledger-ins">INS {box.insurance.label}</small> : null}
        {settled ? <small>{settled}</small> : null}
        {insSettled ? <small className="tt-ledger-ins">{insSettled}</small> : null}
      </span>
      <span className="tt-ledger-action">
        {showCards ? (
          canCorrect ? (
            <BoxCardControls
              hand={hand}
              title={`${box.playerName} · Box ${box.boxNumber}`}
              canEdit
              compactCorrect
              onAdd={(rank) => onAddCard?.(box.id, rank)}
              onUndo={() => onUndoCard?.(box.id)}
            />
          ) : (
            <HandTiles hand={hand} />
          )
        ) : unresolved && onSettle ? null : (
          <span className="tt-ledger-slot">{doubled ? "2×" : split ? "SPLIT" : "—"}</span>
        )}
      </span>
      {unresolved && onSettle ? (
        <span className="tt-ledger-settle">
          <ResultControls box={box} onSettle={onSettle} />
          {showInsSettle ? (
            <span className="tt-ledger-ins-results" role="group" aria-label={`Settle insurance · Box ${box.boxNumber}`}>
              <TableButton
                variant="compact"
                className="ins-win"
                data-insurance-action="won"
                onClick={() => onSettleInsurance?.("DEALER_BLACKJACK")}
              >
                INS WON
              </TableButton>
              <TableButton
                variant="compact"
                className="ins-lose"
                data-insurance-action="lost"
                onClick={() => onSettleInsurance?.("NO_DEALER_BLACKJACK")}
              >
                INS LOST
              </TableButton>
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

/** Dense ledger for real box instances only. Optional compact rules strip. */
export function DealerLedger({
  children,
  playerCount,
  boxCount,
  showRules = true,
  summary,
}: {
  children: ReactNode;
  playerCount?: number;
  boxCount?: number;
  showRules?: boolean;
  summary?: ReactNode;
}) {
  return (
    <div className="tt-ledger-wrap">
      {summary}
      {showRules ? (
        <p className="tt-dealer-rules" data-dealer-rules="true">
          Blackjack pays 3 to 2 · Insurance pays 2 to 1
        </p>
      ) : null}
      <div className="tt-ledger" data-player-count={playerCount} data-box-count={boxCount} data-ledger="true">
        <div className="tt-ledger-head">
          <span>PLAYER</span>
          <span>MAIN BET</span>
          <span>ACTION</span>
        </div>
        {children}
      </div>
    </div>
  );
}
