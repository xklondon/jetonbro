"use client";

import { chipCompositionFromMillis } from "@/domain/jetons/chips";
import { CasinoJeton } from "./CasinoJeton";

/** Exact greedy composition — chip faces sum to the pot (incl. blinds). No fillers. */
function potClusterChips(millis: string): { label: string; key: string }[] {
  let value = 0n;
  try {
    value = BigInt(millis || "0");
  } catch {
    value = 0n;
  }
  if (value <= 0n) return [];
  return chipCompositionFromMillis(value).map((chip, index) => ({
    label: chip.label,
    key: `${chip.label}-${index}`,
  }));
}

function chipFaceSum(chips: { label: string }[]): number {
  return chips.reduce((sum, chip) => {
    const n = Number(chip.label);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** Central pot — jeton cluster above POT label + total; side pots only when present. */
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
  const cluster = showStack ? potClusterChips(millis!) : [];
  const extras = sidePots.filter((pot) => pot.label !== "0");
  const faceSum = chipFaceSum(cluster);

  return (
    <div className="pm-poker-pot" data-poker-centre="true">
      {cluster.length > 0 ? (
        <div
          className="pm-poker-pot-cluster"
          data-pot-chips="true"
          data-pot-chip-count={String(cluster.length)}
          data-pot-chip-sum={String(faceSum)}
          aria-hidden="true"
        >
          {cluster.map((chip, index) => (
            <span key={chip.key} className={`pm-poker-pot-chip is-i${index % 8}`}>
              <CasinoJeton denomination={chip.label} size="md" label={chip.label} />
            </span>
          ))}
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
              SIDE {pot.index} · {pot.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
