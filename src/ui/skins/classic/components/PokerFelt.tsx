"use client";

import { useState } from "react";
import type { PokerSeatView, PokerTableView } from "@/application/queries/views";
import { communityCardLimit } from "@/domain/poker/cards";
import { chipsFromMillis } from "./chips";
import { PlayingCard } from "./PlayingCard";
import { PokerCardSheet } from "./PokerCardPicker";
import { ClothName } from "./ClothName";

function seatStatus(seat: PokerSeatView): string {
  if (seat.status === "FOLDED") return "FOLDED";
  if (seat.status === "ALL_IN") return "ALL IN";
  if (seat.isActor) return "YOUR TURN";
  if (seat.streetAction === "CHECK") return "CHECKED";
  if (seat.streetAction === "CALL") return "CALLED";
  if (seat.streetAction === "BET") return "BET";
  if (seat.streetAction === "RAISE") return "RAISED";
  if (seat.streetAction === "ALL_IN") return "ALL IN";
  return "Waiting";
}

const BOARD_SLOTS = 5;

export function PokerFelt({
  view,
  onCommand,
}: {
  view: PokerTableView;
  onCommand?: (command: string, payload?: Record<string, string>) => void;
}) {
  const [sheet, setSheet] = useState<"hole" | "board" | null>(null);
  const owed = view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1;
  const potChips = chipsFromMillis(view.pot.millis);
  const showBoard = view.phase !== "POKER_SETUP";
  const showRoles = view.phase !== "POKER_SETUP";
  const boardMax = communityCardLimit(view.phase);
  const ownHole = view.seats.find((seat) => seat.userId === view.viewerId)?.holeCards ?? [];

  return (
    <main className="felt poker-felt" data-card-editor={sheet ? "open" : "closed"}>
      <div className="table-surface poker-surface">
          <ClothName name={view.tableName} />
          {showBoard ? (
            <div className="poker-board">
              <div className="community-slots" data-community-cards="true">
                {Array.from({ length: BOARD_SLOTS }, (_, index) => {
                  const card = view.communityCards[index];
                  if (card) {
                    return <PlayingCard key={`${card.label}-${index}`} rank={card.rank} suit={card.suit} size="felt" />;
                  }
                  return (
                    <span key={`slot-${index}`} className="card-slot" data-card-slot={index} aria-hidden="true">
                      ♠
                    </span>
                  );
                })}
              </div>
              {view.canEditCommunity ? (
                <button type="button" className="add-cards is-compact" onClick={() => setSheet("board")}>
                  + BOARD CARDS
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="poker-pot" data-drop-pot="pot">
            {view.pot.millis !== "0" ? (
              <span className="chip-pile compact poker-pot-chips">
                {potChips.map((chip, index) => (
                  <span key={`${chip.label}-${index}`} className={`chip ${chip.className}`}>
                    {chip.label}
                  </span>
                ))}
              </span>
            ) : null}
            <small>POT</small>
            <strong>{view.pot.label}</strong>
            {owed ? <div className="poker-to-call">TO CALL {view.toCall.label}</div> : null}
            {sidePots ? (
              <ul className="poker-pot-list">
                {view.pots.map((pot) => (
                  <li key={pot.index} data-pot-index={pot.index}>
                    {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                    {pot.winnerPlayerIds.length > 0 ? " awarded" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {view.winners.length > 0 ? (
              <ul className="poker-pot-list" data-winners="true">
                {view.winners.map((winner) => (
                  <li key={winner.userId}>
                    {winner.name} · {winner.amount.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="dealer-list poker-seats">
            {view.seats.map((seat, index) => (
              <section
                key={seat.userId}
                className={`dealer-player poker-seat seat-plaque${seat.isActor ? " is-actor" : ""}${seat.isDealer ? " is-dealer" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}`}
                data-player-id={seat.userId}
                data-actor={seat.isActor ? "true" : "false"}
                data-seat-status={seat.status}
                data-seat-index={index + 1}
                data-dealer={seat.isDealer ? "true" : "false"}
              >
                <header className="dealer-player-head">
                  <div>
                    {showRoles ? (
                      <div className="poker-seat-markers">
                        {seat.isDealer ? (
                          <span className="dealer-badge" aria-label="Poker Dealer">
                            D
                          </span>
                        ) : null}
                        {seat.isSmallBlind ? <span className="blind-badge">SB</span> : null}
                        {seat.isBigBlind ? <span className="blind-badge">BB</span> : null}
                      </div>
                    ) : null}
                    <strong>{seat.name}</strong>
                    <div className="poker-seat-status">{seatStatus(seat)}</div>
                  </div>
                  <div className="dealer-player-balances">
                    <span>
                      <small>AVAILABLE</small> {seat.available.label}
                    </span>
                    {showRoles ? (
                      <span data-street-commit="true">
                        <small>STREET</small> {seat.streetContribution.label}
                      </span>
                    ) : null}
                  </div>
                </header>
                {seat.holeCards && seat.holeCards.length > 0 ? (
                  <div className="hole-cards" data-hole-cards="own">
                    {seat.holeCards.map((card, cardIndex) => (
                      <PlayingCard key={`${card.label}-${cardIndex}`} rank={card.rank} suit={card.suit} size="hole" />
                    ))}
                  </div>
                ) : seat.hasHoleCards ? (
                  <div className="hole-hidden" data-hole-cards="hidden">
                    HOLE CARDS IN
                  </div>
                ) : null}
                {view.canEditHole && seat.userId === view.viewerId ? (
                  <button type="button" className="add-cards is-compact" onClick={() => setSheet("hole")}>
                    + HOLE CARDS
                  </button>
                ) : null}
              </section>
            ))}
          </div>
      </div>
      {sheet === "board" ? (
        <PokerCardSheet
          title="Board cards"
          cards={view.communityCards}
          max={boardMax}
          onSave={(cards) => onCommand?.("setPokerCommunityCards", { cards: JSON.stringify(cards) })}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "hole" ? (
        <PokerCardSheet
          title="Hole cards"
          cards={ownHole}
          max={2}
          onSave={(cards) => onCommand?.("setPokerHoleCards", { cards: JSON.stringify(cards) })}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </main>
  );
}
