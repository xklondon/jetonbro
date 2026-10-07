"use client";

import { useState } from "react";
import type { HandView } from "@/application/queries/views";
import { CARD_RANKS } from "@/domain/blackjack/cards";
import { Sheet } from "../Sheet";
import { TableButton } from "./TableButton";

/** Rank order for the entry pad (suits not required for Blackjack accounting). */
export const BJ_RANK_PAD = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export function handStatusLabel(hand?: HandView | null): string {
  if (!hand?.label) return "";
  if (/blackjack/i.test(hand.label)) return "BLACKJACK";
  if (/bust/i.test(hand.label)) return "BUST";
  return hand.label.toUpperCase();
}

/** Compact physical-card tiles with total centred beneath the card group. */
export function HandTiles({
  hand,
  emptyLabel = "—",
}: {
  hand?: HandView | null;
  emptyLabel?: string;
}) {
  const ranks = hand?.ranks ?? [];
  const status = handStatusLabel(hand);
  if (ranks.length === 0) {
    return (
      <span className="tt-hand-tiles is-empty" data-box-cards="true" data-hand-empty="true">
        {emptyLabel}
      </span>
    );
  }
  return (
    <span className="tt-hand-tiles" data-box-cards="true">
      <span className="tt-hand-rank-row">
        {ranks.map((rank, index) => (
          <span key={`${rank}-${index}`} className="tt-rank-tile" data-rank={rank}>
            {rank}
          </span>
        ))}
      </span>
      {status ? (
        <em className="tt-hand-total" data-hand-total="true">
          {status}
        </em>
      ) : null}
    </span>
  );
}

/** Rank sheet for recording physical cards — never settles or advances phases. */
export function RankPadSheet({
  open,
  title,
  onClose,
  onAdd,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onAdd: (rank: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} className="tt-rank-sheet" labelledBy="tt-rank-sheet-title">
      <header className="tt-sheet-head">
        <h3 id="tt-rank-sheet-title">{title}</h3>
        <button className="tt-link" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <div className="tt-rank-pad" role="group" aria-label="Card ranks">
        {BJ_RANK_PAD.map((rank) => (
          <button
            key={rank}
            type="button"
            className="tt-rank-key"
            onClick={() => {
              onAdd(rank);
              onClose();
            }}
          >
            {rank}
          </button>
        ))}
      </div>
      <p className="tt-muted tt-rank-note">Records the physical deal. Does not settle or choose winners.</p>
    </Sheet>
  );
}

/** Dealer hand panel — ranks with total under the cards. */
export function DealerHandPanel({
  hand,
  canEdit,
  onAdd,
  onUndo,
  quietEmpty = false,
}: {
  hand?: HandView | null;
  canEdit: boolean;
  onAdd: (rank: string) => void;
  onUndo: () => void;
  /** Compact Dealer band: reserve height without a giant “No cards” label. */
  quietEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ranks = hand?.ranks ?? [];
  const empty = ranks.length === 0;

  return (
    <div
      className={`tt-dealer-hand${quietEmpty && empty ? " is-quiet-empty" : ""}`}
      data-dealer-hand="true"
      data-dealer-row="true"
      data-hand-empty={empty ? "true" : "false"}
    >
      <div className="tt-dealer-hand-head">
        <small>DEALER HAND</small>
      </div>
      {quietEmpty && empty && !canEdit ? (
        <span className="tt-hand-tiles is-empty is-quiet" data-box-cards="true" data-hand-empty="true" aria-hidden="true">
          {"\u00a0"}
        </span>
      ) : (
        <HandTiles hand={hand} emptyLabel={quietEmpty ? "—" : "No cards"} />
      )}
      {canEdit ? (
        <div className="tt-dealer-hand-actions">
          <TableButton variant="compact" data-card-action="add" onClick={() => setOpen(true)}>
            + CARD
          </TableButton>
          {ranks.length > 0 ? (
            <TableButton variant="compact" data-card-action="undo" onClick={onUndo}>
              UNDO LAST
            </TableButton>
          ) : null}
        </div>
      ) : null}
      <RankPadSheet open={open} title="Dealer hand" onClose={() => setOpen(false)} onAdd={onAdd} />
    </div>
  );
}

/** Compact card controls for a Player box or a Dealer correction on a ledger row. */
export function BoxCardControls({
  hand,
  title,
  canEdit,
  compactCorrect = false,
  onAdd,
  onUndo,
}: {
  hand?: HandView | null;
  title: string;
  canEdit: boolean;
  /** When true, editing starts behind a CORRECT action (Dealer correction path). */
  compactCorrect?: boolean;
  onAdd: (rank: string) => void;
  onUndo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const ranks = hand?.ranks ?? [];
  const showEdit = canEdit && (!compactCorrect || correcting);

  return (
    <div className="tt-box-cards" data-box-card-controls="true">
      <HandTiles hand={hand} />
      {canEdit && compactCorrect && !correcting ? (
        <TableButton variant="ghost" className="tt-correct" data-card-action="correct" onClick={() => setCorrecting(true)}>
          CORRECT
        </TableButton>
      ) : null}
      {showEdit ? (
        <span className="tt-box-card-actions">
          <TableButton variant="compact" data-card-action="add" onClick={() => setOpen(true)}>
            + CARD
          </TableButton>
          {ranks.length > 0 ? (
            <TableButton variant="compact" data-card-action="undo" onClick={onUndo}>
              UNDO
            </TableButton>
          ) : null}
        </span>
      ) : null}
      <RankPadSheet open={open} title={title} onClose={() => setOpen(false)} onAdd={onAdd} />
    </div>
  );
}

/** Guard: only known Blackjack ranks are offered. */
export function isBlackjackRank(rank: string): boolean {
  return (CARD_RANKS as readonly string[]).includes(rank);
}
