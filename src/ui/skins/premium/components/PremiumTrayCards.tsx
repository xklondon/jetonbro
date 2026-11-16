"use client";

import type { PokerCardView } from "@/application/queries/views";
import { SUIT_GLYPH } from "@/domain/poker/cards";

/**
 * Compact YOUR CARDS / ADD CARDS strip for the Premium tray.
 * Display-only Card Assist — never evaluates hands or settles pots.
 * `inline` (Poker): label + cards + button(s) on one horizontal row.
 * Poker dealer may also expose + BOARD on the same row (community faces stay on felt).
 */
export function PremiumTrayCards({
  cards,
  enabled,
  label = "YOUR CARDS",
  onAdd,
  onAddBoard,
  onRemoveLast,
  layout = "stack",
}: {
  cards: PokerCardView[] | string[];
  enabled: boolean;
  label?: string;
  onAdd?: () => void;
  /** Authorized dealer community-card entry — same row, faces stay on felt. */
  onAddBoard?: () => void;
  onRemoveLast?: () => void;
  /** Poker tray uses a single compact row; Blackjack keeps the stacked strip. */
  layout?: "stack" | "inline";
}) {
  const faces = cards.map((card) =>
    typeof card === "string" ? card : card.label || `${card.rank}${SUIT_GLYPH[card.suit as keyof typeof SUIT_GLYPH] ?? ""}`,
  );
  const inline = layout === "inline";
  const showBoard = Boolean(onAddBoard);
  const showMine = Boolean(onAdd);
  const mineLabel = showBoard ? "+ MINE" : inline ? "+ CARDS" : "ADD CARDS";

  return (
    <div
      className={`pm-tray-cards${inline ? " is-inline" : ""}${showBoard ? " has-board-add" : ""}`}
      data-tray-cards="true"
      data-tray-cards-layout={layout}
      data-tray-cards-enabled={enabled || showBoard ? "true" : "false"}
    >
      <small className="pm-tray-cards-label">{label}</small>
      <div className="pm-tray-cards-row" data-tray-card-faces="true">
        {faces.length === 0 ? <span className="pm-tray-cards-empty">{inline ? "" : "—"}</span> : null}
        {faces.map((face, index) => (
          <span key={`${face}-${index}`} className="pm-playing-card is-mini" data-poker-card={face}>
            {face}
          </span>
        ))}
      </div>
      <div className="pm-tray-cards-actions">
        {onRemoveLast && faces.length > 0 ? (
          <button
            type="button"
            className="pm-tray-cards-btn"
            disabled={!enabled}
            aria-label="Remove last card"
            data-tray-remove-card="true"
            onClick={onRemoveLast}
          >
            UNDO
          </button>
        ) : null}
        {showMine ? (
          <button
            type="button"
            className="pm-tray-cards-btn is-primary"
            disabled={!enabled}
            aria-label={showBoard ? "Add your cards" : "Add cards"}
            data-tray-add-cards="true"
            data-tray-add-mine={showBoard ? "true" : undefined}
            title={enabled ? (showBoard ? "Add your cards" : "Add cards") : "Card entry unavailable in this phase"}
            onClick={() => enabled && onAdd?.()}
          >
            {mineLabel}
          </button>
        ) : null}
        {showBoard ? (
          <button
            type="button"
            className="pm-tray-cards-btn is-primary"
            aria-label="Add board cards"
            data-tray-add-board="true"
            title="Add board cards"
            onClick={() => onAddBoard?.()}
          >
            + BOARD
          </button>
        ) : null}
      </div>
    </div>
  );
}
