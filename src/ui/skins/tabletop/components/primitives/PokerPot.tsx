"use client";

import type { PokerTableView } from "@/application/queries/views";
import { ChipStack } from "./Jeton";

/** Display labels for the in-felt round track — DEAL presents as SHUFFLE. */
export function pokerTrackLabel(id: string): string {
  if (id === "DEAL") return "SHUFFLE";
  return id.replaceAll("_", "-");
}

/** Compact central pot on the cloth — chips dominate; no competing street title. */
export function PokerPot({ view, dropHot = false }: { view: PokerTableView; dropHot?: boolean }) {
  const setup = view.phase === "POKER_SETUP";
  const complete = view.phase === "HAND_COMPLETE";
  const showdown = view.phase === "SHOWDOWN";
  const owed = !view.potPaid && !complete && !showdown && view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1 && (view.seats.some((seat) => seat.status === "ALL_IN") || showdown || complete);

  if (setup) {
    return (
      <div className="tt-pot tt-pot-cloth tt-blinds" data-poker-pot="setup">
        <span>
          SB <strong>{view.smallBlind.label}</strong>
        </span>
        <span>
          BB <strong>{view.bigBlind.label}</strong>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`tt-pot tt-pot-cloth${dropHot ? " is-drop-hot" : ""}`}
      data-drop-pot="pot"
      data-pot-paid={view.potPaid ? "true" : "false"}
      data-poker-pot="live"
    >
      {!view.potPaid && !complete && view.pot.millis !== "0" ? <ChipStack millis={view.pot.millis} max={5} /> : null}
      <small>{view.potPaid || complete ? "POT PAID" : "POT"}</small>
      {!view.potPaid && !complete ? <strong className="tt-pot-amount">{view.pot.label}</strong> : null}
      {owed ? (
        <span className="tt-to-call" data-to-call="true">
          TO CALL <strong>{view.toCall.label}</strong>
        </span>
      ) : null}
      {sidePots ? (
        <ul className="tt-pot-list" data-side-pots="true">
          {view.pots.map((pot) => (
            <li key={pot.index} data-pot-index={pot.index} data-pot-awarded={pot.winnerPlayerIds.length > 0 ? "true" : "false"}>
              {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
              {pot.winnerPlayerIds.length > 0 ? " · awarded" : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {!complete && view.winners.length > 0 ? (
        <ul className="tt-pot-list" data-winners="true">
          {view.winners.map((winner) => (
            <li key={winner.userId}>
              {winner.name} · {winner.amount.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const FALLBACK_TRACK = ["DEAL", "PRE-FLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN"] as const;

/** In-felt round track — SHUFFLE → PRE-FLOP → FLOP → TURN → RIVER → SHOWDOWN. */
export function PokerStreet({ view }: { view: PokerTableView }) {
  const stops =
    view.streetRail.length > 0
      ? view.streetRail
      : FALLBACK_TRACK.map((id, index) => ({
          id,
          state: (view.phase === "POKER_SETUP" && index === 0 ? "current" : "next") as "done" | "current" | "next",
        }));

  return (
    <ol className="tt-streets" aria-label="Round track" data-poker-street="true" data-poker-track="felt">
      {stops.map((stop) => (
        <li
          key={stop.id}
          className={`is-${stop.state}`}
          data-rail={stop.id}
          data-rail-label={pokerTrackLabel(stop.id)}
          data-rail-state={stop.state}
          aria-current={stop.state === "current" ? "step" : undefined}
        >
          <span className="tt-streets-node" aria-hidden="true" />
          <span className="tt-streets-label">{pokerTrackLabel(stop.id)}</span>
        </li>
      ))}
    </ol>
  );
}
