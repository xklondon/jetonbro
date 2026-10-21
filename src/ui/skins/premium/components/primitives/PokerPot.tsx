"use client";

import { chipCompositionFromMillis } from "@/domain/jetons/chips";
import { CasinoJeton } from "./CasinoJeton";

/** Scattered jeton pile for the felt pot — denser than a neat vertical stack. */
function potClusterChips(millis: string): { label: string; key: string }[] {
  let value = 0n;
  try {
    value = BigInt(millis || "0");
  } catch {
    value = 0n;
  }
  if (value <= 0n) return [];
  const base = chipCompositionFromMillis(value);
  const chips = base.slice(0, 8).map((chip, index) => ({
    label: chip.label,
    key: `${chip.label}-${index}`,
  }));
  // Poker0 mound: mixed colours even on small pots (amount stays authoritative below).
  const fillers = ["25", "5", "10", "50", "100"] as const;
  let fill = 0;
  while (chips.length > 0 && chips.length < 6) {
    const label = fillers[fill % fillers.length]!;
    chips.push({ label, key: `${label}-pad-${chips.length}` });
    fill += 1;
  }
  return chips.slice(0, 6);
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

  return (
    <div className="pm-poker-pot" data-poker-centre="true">
      {cluster.length > 0 ? (
        <div
          className="pm-poker-pot-cluster"
          data-pot-chips="true"
          data-pot-chip-count={String(cluster.length)}
          aria-hidden="true"
        >
          {cluster.map((chip, index) => (
            <span key={chip.key} className={`pm-poker-pot-chip is-i${index % 6}`}>
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
