"use client";

import type { PokerCardView } from "@/application/queries/views";
import { SUIT_GLYPH } from "@/domain/poker/cards";

/**
 * Compact YOUR CARDS / ADD CARDS strip for the Premium tray.
 * Display-only Card Assist — never evaluates hands or settles pots.
 */
export function PremiumTrayCards({
  cards,
  enabled,
  label = "YOUR CARDS",
  onAdd,
  onRemoveLast,
}: {
  cards: PokerCardView[] | string[];
  enabled: boolean;
  label?: string;
  onAdd?: () => void;
  onRemoveLast?: () => void;
}) {
  const faces = cards.map((card) =>
    typeof card === "string" ? card : card.label || `${card.rank}${SUIT_GLYPH[card.suit as keyof typeof SUIT_GLYPH] ?? ""}`,
  );

  return (
    <div className="pm-tray-cards" data-tray-cards="true" data-tray-cards-enabled={enabled ? "true" : "false"}>
      <div className="pm-tray-cards-head">
        <small>{label}</small>
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
          <button
            type="button"
            className="pm-tray-cards-btn is-primary"
            disabled={!enabled}
            aria-label="Add cards"
            data-tray-add-cards="true"
            title={enabled ? "Add cards" : "Card entry unavailable in this phase"}
            onClick={() => enabled && onAdd?.()}
          >
            ADD CARDS
          </button>
        </div>
      </div>
      <div className="pm-tray-cards-row" data-tray-card-faces="true">
        {faces.length === 0 ? <span className="pm-tray-cards-empty">—</span> : null}
        {faces.map((face, index) => (
          <span key={`${face}-${index}`} className="pm-playing-card is-mini" data-poker-card={face}>
            {face}
          </span>
        ))}
      </div>
    </div>
  );
}
