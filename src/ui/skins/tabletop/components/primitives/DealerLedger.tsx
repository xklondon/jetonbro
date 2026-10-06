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

const COMPACT_LABEL: Record<BoxOutcome, string> = {
  LOST: "LOST",
  PUSH: "PUSH",
  BLACKJACK: "BLACKJACK",
  WON: "WON",
};

const ACCESS_NAME: Record<BoxOutcome, string> = {
  LOST: "Lost",
  PUSH: "Stand-off",
  BLACKJACK: "Blackjack",
  WON: "Won",
};

const RESULT_KIND: Record<BoxOutcome, "lost" | "push" | "blackjack" | "won"> = {
  LOST: "lost",
  PUSH: "push",
  BLACKJACK: "blackjack",
  WON: "won",
};

function resultBadge(outcome: BoxOutcome): string {
  return RAIL_TITLE[outcome];
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
      {PAYOUT_RAIL_ORDER.map((outcome) => (
          <TableButton
            key={outcome}
            variant="result"
            result={RESULT_KIND[outcome]}
            data-payout-action="true"
            aria-label={`Set Box ${box.boxNumber} result: ${ACCESS_NAME[outcome]}`}
            onClick={() => {
              setSubmitted(true);
              onSettle(outcome);
            }}
          >
            {COMPACT_LABEL[outcome] === "BJ" ? "BJ" : COMPACT_LABEL[outcome]}
          </TableButton>
      ))}
    </span>
  );
}

/** Large settled result badge — stronger than stake copy. */
export function BoxResultBadge({
  outcome,
  returnedLabel,
  insuranceResult,
}: {
  outcome: BoxOutcome;
  returnedLabel?: string | null;
  insuranceResult?: string | null;
}) {
  const kind = RESULT_KIND[outcome];
  const ins = insuranceCopy(insuranceResult ?? null);
  return (
    <span className={`tt-result-badge is-${kind}`} data-box-result={outcome} data-payout-state={outcome}>
      <strong>{resultBadge(outcome)}</strong>
      {returnedLabel ? <em data-returned="true">{returnedLabel}</em> : null}
      {ins ? <small className="tt-ledger-ins" data-insurance-result={insuranceResult ?? ""}>{ins}</small> : null}
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

  const payoutPhase = phase === "PAYOUT" || phase === "ROUND_COMPLETE";
  const unresolved = Boolean(payoutEnabled && !box.outcome && onSettle);
  const doubled = box.isDoubled;
  const split = box.isSplit;
  const showCards = phase === "PLAYING" || payoutPhase;
  const hand = box.hand as HandView | undefined;
  const canCorrect = Boolean(dealerMayCorrect && hand?.canEdit && onAddCard && onUndoCard);
  const showInsSettle = Boolean(insuranceSettleEnabled && box.insurance && !box.insuranceResult && onSettleInsurance);
  const settled = Boolean(box.outcome);

  return (
    <div
      className={`tt-ledger-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : settled ? " is-settled" : " is-idle"}${showCards ? " has-cards" : ""}${payoutPhase ? " is-payout" : ""}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-box-phase={phase}
      data-player-row="true"
      data-player-group={box.playerId}
      data-box-number={box.boxNumber}
      data-doubled={doubled ? "true" : undefined}
      data-split={split ? "true" : undefined}
      data-payout-row={unresolved || settled ? "true" : undefined}
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
      </span>
      <span className={`tt-ledger-action${payoutPhase ? " is-cards" : ""}`}>
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
      {payoutPhase && settled && box.outcome ? (
        <span className="tt-ledger-result-col">
          <BoxResultBadge outcome={box.outcome} returnedLabel={box.returned?.label} insuranceResult={box.insuranceResult} />
        </span>
      ) : null}
      {payoutPhase && !settled ? <span className="tt-ledger-result-col"><span className="tt-ledger-slot">—</span></span> : null}
      {payoutPhase && unresolved && onSettle ? (
        <span className="tt-ledger-settle is-full">
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
  payoutMode = false,
}: {
  children: ReactNode;
  playerCount?: number;
  boxCount?: number;
  showRules?: boolean;
  summary?: ReactNode;
  payoutMode?: boolean;
}) {
  return (
    <div className="tt-ledger-wrap">
      {summary}
      {showRules ? (
        <p className="tt-dealer-rules" data-dealer-rules="true">
          Blackjack pays 3 to 2 · Insurance pays 2 to 1
        </p>
      ) : null}
      <div
        className={`tt-ledger${payoutMode ? " is-payout" : ""}`}
        data-player-count={playerCount}
        data-box-count={boxCount}
        data-ledger="true"
        data-ledger-mode={payoutMode ? "payout" : "play"}
      >
        <div className="tt-ledger-head">
          <span>PLAYER</span>
          <span>MAIN BET</span>
          <span>{payoutMode ? "CARDS" : "ACTION"}</span>
          {payoutMode ? <span>RESULT</span> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
