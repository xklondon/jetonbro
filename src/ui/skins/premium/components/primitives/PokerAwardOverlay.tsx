"use client";

import type { PokerTableView } from "@/application/queries/views";
import { formatJetons } from "@/domain/money";
import { splitPotEqually } from "@/domain/poker/pots";

function potMillis(label: string, millis?: string): bigint {
  try {
    if (millis) return BigInt(millis);
  } catch {
    /* fall through */
  }
  const n = Number(label);
  return Number.isFinite(n) ? BigInt(Math.round(n * 1000)) : 0n;
}

/** Felt-overlaid showdown award — AWARD POT (1) or SPLIT POT (2+), with payout preview. */
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
  const domainSeats = view.seats.map((seat) => ({ playerId: seat.userId, orderIndex: seat.orderIndex }));
  const dealerId = view.seats.find((seat) => seat.isDealer)?.userId ?? view.seats[0]?.userId ?? "";

  const selections = pots.map((pot) => ({
    pot,
    selected: winners[pot.index] ?? pot.winnerPlayerIds,
    awarded: pot.winnerPlayerIds.length > 0,
  }));

  const allAssigned = selections.every((item) => item.selected.length > 0 || item.awarded);
  const multiWinner = selections.some((item) => item.selected.length > 1);
  const confirmLabel = multiWinner ? "SPLIT POT" : "AWARD POT";

  const payoutTotals = new Map<string, bigint>();
  for (const item of selections) {
    if (item.selected.length === 0) continue;
    const amount = potMillis(item.pot.amount.label, item.pot.amount.millis);
    const shares = splitPotEqually(amount, item.selected, dealerId, domainSeats);
    for (const [playerId, share] of shares) {
      payoutTotals.set(playerId, (payoutTotals.get(playerId) ?? 0n) + share);
    }
  }
  const payoutPreview = [...payoutTotals.entries()].map(([userId, amount]) => {
    const name = view.seats.find((seat) => seat.userId === userId)?.name ?? userId;
    return { userId, name, label: formatJetons(amount) };
  });

  return (
    <div className="pm-poker-payout" data-award-panel="true" data-payout-overlay="true">
      <section className="pm-bj-payout-panel pm-award" data-poker-award="true">
        <header className="pm-award-head">
          <strong>
            {pots[0] ? (
              <>
                {pots.length > 1
                  ? `${pots[0].index === 0 ? "MAIN POT" : `SIDE POT ${pots[0].index}`} · ${pots[0].amount.label}`
                  : `MAIN POT · ${pots[0].amount.label}`}
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
                <small data-award-pot-label="true">
                  {pot.index === 0 ? "MAIN POT" : `SIDE POT ${pot.index}`} · {pot.amount.label}
                  {awarded ? " · awarded" : ""}
                </small>
              ) : null}
              <div
                className="pm-award-winners pm-bj-payout-actions"
                role="group"
                aria-label={`Winners for pot ${pot.index}`}
              >
                {view.seats
                  .filter((seat) => pot.eligiblePlayerIds.includes(seat.userId))
                  .map((seat) => {
                    const on = selected.includes(seat.userId);
                    return (
                      <button
                        key={seat.userId}
                        type="button"
                        className={`pm-award-seat${on ? " is-selected is-win" : ""}`}
                        aria-pressed={on}
                        disabled={awarded || busy}
                        onClick={() => onToggle(pot.index, seat.userId)}
                      >
                        <svg className="pm-outcome-icon" viewBox="0 0 48 48" aria-hidden="true">
                          <circle
                            cx="24"
                            cy="24"
                            r="18"
                            fill={on ? "rgba(23, 133, 90, 0.85)" : "rgba(42, 48, 54, 0.55)"}
                            stroke="rgba(244, 234, 213, 0.45)"
                            strokeWidth="2"
                          />
                          <text
                            x="24"
                            y="30"
                            textAnchor="middle"
                            fontSize="14"
                            fontWeight="800"
                            fill={on ? "#f4ead5" : "#d4b882"}
                          >
                            {seat.name.slice(0, 1).toUpperCase()}
                          </text>
                        </svg>
                        <span>{seat.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
        {payoutPreview.length > 0 ? (
          <div className="pm-award-preview" data-award-preview="true">
            {payoutPreview.map((row) => (
              <span key={row.userId} data-award-share={row.userId}>
                {row.name} · {row.label}
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="pm-console-btn is-primary pm-award-confirm"
          data-award-confirm="true"
          data-award-mode={multiWinner ? "split" : "award"}
          disabled={busy || !allAssigned}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </section>
    </div>
  );
}
