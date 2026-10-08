"use client";

import type { PokerTableView } from "@/application/queries/views";
import { ChipStack } from "./Jeton";

/** Display labels for the in-felt round track — DEAL presents as SHUFFLE. */
export function pokerTrackLabel(id: string): string {
  if (id === "DEAL") return "SHUFFLE";
  return id.replaceAll("_", "-");
}

/** Whether TO CALL should appear near the Player action dock (never inside the pot stack). */
export function pokerToCallVisible(view: PokerTableView): boolean {
  return (
    view.phase !== "POKER_SETUP" &&
    view.phase !== "HAND_COMPLETE" &&
    view.phase !== "SHOWDOWN" &&
    !view.potPaid &&
    view.toCall.millis !== "0"
  );
}

/** Centre pot — chips and POT amount only; TO CALL lives by the action dock. */
export function PokerPot({ view, dropHot = false }: { view: PokerTableView; dropHot?: boolean }) {
  const setup = view.phase === "POKER_SETUP";
  const complete = view.phase === "HAND_COMPLETE";
  const showdown = view.phase === "SHOWDOWN";
  const sidePots = view.pots.length > 1 && (view.seats.some((seat) => seat.status === "ALL_IN") || showdown || complete);

  if (setup) {
    return (
      <div className="tt-pot tt-pot-cloth tt-blinds" data-poker-pot="setup" data-poker-zone="pot">
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
      data-poker-zone="pot"
    >
      <div className="tt-pot-chips-zone" data-poker-zone="chips">
        {!view.potPaid && !complete && view.pot.millis !== "0" ? <ChipStack millis={view.pot.millis} max={5} /> : null}
      </div>
      <div className="tt-pot-amount-zone" data-poker-zone="amount">
        <small>{view.potPaid || complete ? "POT PAID" : "POT"}</small>
        {!view.potPaid && !complete ? <strong className="tt-pot-amount">{view.pot.label}</strong> : null}
      </div>
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
    <ol className="tt-streets tt-streets-arc" aria-label="Round track" data-poker-street="true" data-poker-track="felt" data-poker-zone="track">
      {stops.map((stop) => {
        const label = pokerTrackLabel(stop.id);
        return (
          <li
            key={stop.id}
            className={`is-${stop.state}`}
            data-rail={stop.id}
            data-rail-label={label}
            data-rail-state={stop.state}
            aria-current={stop.state === "current" ? "step" : undefined}
          >
            <span className="tt-streets-node" aria-hidden="true" />
            <span className="tt-streets-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
