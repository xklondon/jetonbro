"use client";

import type { PokerTableView } from "@/application/queries/views";

/** Compact showdown award overlay — reuses Owner selection/award handlers. */
export function PokerAwardOverlay({
  view,
  winners,
  onToggle,
  onConfirm,
  onClear,
  busy,
}: {
  view: PokerTableView;
  winners: Record<number, string[]>;
  onToggle: (potIndex: number, userId: string) => void;
  onConfirm: () => void;
  onClear: () => void;
  busy?: boolean;
}) {
  if (!view.canAward) return null;
  const pots = view.pots.length > 0 ? view.pots : [];
  return (
    <div className="pm-award" data-award-panel="true">
      <header className="pm-award-head">
        <strong>
          {pots[0] ? (
            <>
              {pots[0].index === 0 ? "MAIN POT" : `SIDE POT ${pots[0].index}`} · {pots[0].amount.label}
            </>
          ) : (
            <>MAIN POT · {view.pot.label}</>
          )}
        </strong>
        <button type="button" className="pm-award-clear" onClick={onClear} disabled={busy}>
          CLEAR
        </button>
      </header>
      {pots.map((pot) => {
        const selected = winners[pot.index] ?? pot.winnerPlayerIds;
        const awarded = pot.winnerPlayerIds.length > 0;
        return (
          <div key={pot.index} className="pm-award-pot" data-pot-index={pot.index}>
            {pots.length > 1 ? (
              <small>
                {pot.index === 0 ? "MAIN" : `SIDE ${pot.index}`} · {pot.amount.label}
                {awarded ? " · awarded" : ""}
              </small>
            ) : null}
            <div className="pm-award-winners" role="group" aria-label={`Winners for pot ${pot.index}`}>
              {view.seats
                .filter((seat) => pot.eligiblePlayerIds.includes(seat.userId))
                .map((seat) => {
                  const on = selected.includes(seat.userId);
                  return (
                    <button
                      key={seat.userId}
                      type="button"
                      className={`pm-award-seat${on ? " is-selected" : ""}`}
                      aria-pressed={on}
                      disabled={awarded || busy}
                      onClick={() => onToggle(pot.index, seat.userId)}
                    >
                      {seat.name}
                    </button>
                  );
                })}
            </div>
          </div>
        );
      })}
      <button
        type="button"
        className="pm-console-btn is-primary pm-award-confirm"
        data-award-confirm="true"
        disabled={busy}
        onClick={onConfirm}
      >
        AWARD POT
      </button>
    </div>
  );
}
