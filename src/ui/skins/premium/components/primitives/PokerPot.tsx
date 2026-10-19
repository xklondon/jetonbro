"use client";

import { CasinoChipStack } from "./CasinoJeton";

/** Central pot — felt-integrated label + committed CasinoJeton stack; side pots stay separate. */
export function PokerPot({
  amount,
  millis,
  sidePots = [],
}: {
  amount: string;
  millis?: string;
  sidePots?: { index: number; label: string }[];
}) {
  const showStack = Boolean(millis && millis !== "0" && amount !== "0");
  const extras = sidePots.filter((pot) => pot.label !== "0");

  return (
    <div className="pm-poker-pot" data-poker-centre="true">
      {showStack ? (
        <div className="pm-poker-pot-chips" data-pot-chips="true">
          <CasinoChipStack millis={millis!} label={amount} size="md" max={5} />
        </div>
      ) : null}
      <div className="pm-poker-pot-copy">
        <small>POT</small>
        <strong data-pot-amount={amount}>{amount}</strong>
      </div>
      {extras.length > 0 ? (
        <div className="pm-poker-side-pots" data-side-pots="true">
          {extras.map((pot) => (
            <span key={pot.index} data-side-pot={pot.index}>
              SIDE {pot.index + 1} · {pot.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
