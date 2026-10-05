"use client";

import { useState, type ReactNode } from "react";
import type { BoxView } from "@/application/queries/views";
import { PAYOUT_RAIL_ORDER, type BoxOutcome } from "@/domain/blackjack/payouts";
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

/** Payout result keys using TableButton result variants. */
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

/** Dense row for one real box (or empty player seat). */
export function DealerLedgerRow({
  box,
  phase,
  payoutEnabled,
  onSettle,
  playerName,
  availableLabel,
  empty,
}: {
  box?: BoxView;
  phase?: string;
  payoutEnabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
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
  const commitment = box.isDoubled ? "Double" : box.isSplit ? "Split" : null;

  return (
    <div
      className={`tt-ledger-row${box.outcome ? ` is-${box.outcome.toLowerCase()}` : ""}${unresolved ? " is-unresolved" : " is-idle"}`}
      data-box-id={box.id}
      data-blackjack-box-row="true"
      data-box-phase={phase}
      data-player-row="true"
      data-player-group={box.playerId}
      data-payout-row={unresolved || Boolean(box.outcome) ? "true" : undefined}
    >
      <span className="tt-ledger-who">
        <strong>{box.playerName || playerName || "Player"}</strong>
        <small>BOX {box.boxNumber}</small>
      </span>
      <span className="tt-ledger-stake">
        <ChipStack millis={box.bet.millis} max={4} />
        <strong>{box.bet.label}</strong>
        {box.insurance ? <small className="tt-ledger-ins">INS {box.insurance.label}</small> : null}
        {commitment || settled ? <small>{commitment ?? settled}</small> : null}
      </span>
      <span className="tt-ledger-action">
        {unresolved && onSettle ? <ResultControls box={box} onSettle={onSettle} /> : <span className="tt-ledger-slot">{commitment ?? "—"}</span>}
      </span>
    </div>
  );
}

/** Dense ledger for real Players/boxes only. Optional compact rules strip. */
export function DealerLedger({
  children,
  playerCount,
  showRules = true,
  summary,
}: {
  children: ReactNode;
  playerCount?: number;
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
      <div className="tt-ledger" data-player-count={playerCount} data-ledger="true">
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
