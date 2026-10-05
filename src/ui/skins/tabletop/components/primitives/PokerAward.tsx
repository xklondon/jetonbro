"use client";

import type { PokerTableView } from "@/application/queries/views";
import { assignBlinds, nextDealer, orderedSeats } from "@/domain/poker/seats";

/** Presentation-only next-hand preview from domain seat helpers — never posts blinds. */
export function nextHandPreview(view: PokerTableView): { dealer: string; sb: string; bb: string } | null {
  if (view.phase !== "HAND_COMPLETE" || view.seats.length < 2) return null;
  const domain = orderedSeats(
    view.seats.filter((seat) => !seat.sittingOut).map((seat) => ({ playerId: seat.userId, orderIndex: seat.orderIndex })),
  );
  const currentDealer = view.seats.find((seat) => seat.isDealer)?.userId ?? null;
  try {
    const dealer = nextDealer(domain, currentDealer);
    const blinds = assignBlinds(domain, dealer.playerId);
    const name = (id: string) => view.seats.find((seat) => seat.userId === id)?.name ?? id;
    return {
      dealer: name(blinds.dealerPlayerId),
      sb: name(blinds.smallBlindPlayerId),
      bb: name(blinds.bigBlindPlayerId),
    };
  } catch {
    return null;
  }
}

/** Compact Hand Complete banner with winner and next-button preview. */
export function PokerHandComplete({ view }: { view: PokerTableView }) {
  if (view.phase !== "HAND_COMPLETE") return null;
  const next = nextHandPreview(view);
  return (
    <div className="tt-hand-complete" data-hand-complete="true">
      {view.winners.length > 0 ? (
        <p data-hand-winners="true">
          {view.winners.map((winner) => `${winner.name} · ${winner.amount.label}`).join(" · ")}
        </p>
      ) : (
        <p>Balances updated.</p>
      )}
      {next ? (
        <small data-next-rotation="true">
          NEXT · D {next.dealer} · SB {next.sb} · BB {next.bb}
        </small>
      ) : null}
    </div>
  );
}

/** Inline showdown award controls for Owner — eligible winners only. */
export function PokerAwardControl({
  view,
  winners,
  onToggle,
  onConfirm,
  onClose,
}: {
  view: PokerTableView;
  winners: Record<number, string[]>;
  onToggle: (potIndex: number, userId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!view.canAward) return null;
  return (
    <div className="tt-award-panel" data-award-panel="true">
      <header>
        <strong>SHOWDOWN</strong>
        <button type="button" className="tt-link" onClick={onClose}>
          Clear
        </button>
      </header>
      {view.pots.map((pot) => {
        const selected = winners[pot.index] ?? pot.winnerPlayerIds;
        const awarded = pot.winnerPlayerIds.length > 0;
        return (
          <div key={pot.index} className={`tt-pot-assign poker-pot-assign${awarded ? " is-awarded" : ""}`} data-pot-index={pot.index}>
            <strong>
              {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
              {awarded ? " · awarded" : ""}
            </strong>
            <div className="tt-pot-winners" role="group" aria-label={`Winners for pot ${pot.index}`}>
              {view.seats
                .filter((seat) => pot.eligiblePlayerIds.includes(seat.userId))
                .map((seat) => {
                  const on = selected.includes(seat.userId);
                  return (
                    <button
                      key={seat.userId}
                      type="button"
                      className={`tt-btn${on ? " gold" : ""}`}
                      aria-pressed={on}
                      disabled={awarded}
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
      <button className="tt-btn gold" type="button" data-award-confirm="true" onClick={onConfirm}>
        AWARD POT
      </button>
    </div>
  );
}
