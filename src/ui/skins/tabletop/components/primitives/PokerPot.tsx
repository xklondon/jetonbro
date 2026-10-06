"use client";

import type { PokerTableView } from "@/application/queries/views";
import { ChipStack } from "./Jeton";

/** Compact central pot / street / award on the cloth — not a rectangular card. */
export function PokerPot({ view, dropHot = false }: { view: PokerTableView; dropHot?: boolean }) {
  const setup = view.phase === "POKER_SETUP";
  const complete = view.phase === "HAND_COMPLETE";
  const showdown = view.phase === "SHOWDOWN";
  const owed = !view.potPaid && !complete && !showdown && view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1 && (view.seats.some((seat) => seat.status === "ALL_IN") || showdown || complete);

  if (setup) {
    return (
      <div className="tt-pot tt-pot-cloth tt-blinds" data-poker-pot="setup">
        <span className="tt-pot-street">TABLE SETUP</span>
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
      <span className="tt-pot-street">{(view.phaseLabel || view.phase).replaceAll("_", " ")}</span>
      <small>{view.potPaid || complete ? "POT PAID" : "POT"}</small>
      {!view.potPaid && !complete ? <strong className="tt-pot-amount">{view.pot.label}</strong> : null}
      {!view.potPaid && !complete && view.pot.millis !== "0" ? <ChipStack millis={view.pot.millis} max={4} /> : null}
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

/** Compact street rail — secondary to the phase heading. */
export function PokerStreet({ view }: { view: PokerTableView }) {
  if (view.phase === "POKER_SETUP" || view.streetRail.length === 0) return null;
  return (
    <ol className="tt-streets" aria-label="Street" data-poker-street="true">
      {view.streetRail.map((stop) => (
        <li
          key={stop.id}
          className={`is-${stop.state}`}
          data-rail={stop.id}
          data-rail-state={stop.state}
          aria-current={stop.state === "current" ? "step" : undefined}
        >
          {stop.id.replaceAll("_", " ")}
        </li>
      ))}
    </ol>
  );
}
