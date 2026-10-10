"use client";

const CHIPS = [
  { value: "5", className: "is-5" },
  { value: "10", className: "is-10" },
  { value: "25", className: "is-25" },
  { value: "50", className: "is-50" },
  { value: "100", className: "is-100" },
] as const;

export function CasinoTray({
  available,
  trayEnabled,
  onChip,
  onPlaceBet,
  placeBetEnabled,
}: {
  available: string;
  trayEnabled?: boolean;
  onChip?: (value: string) => void;
  onPlaceBet?: () => void;
  placeBetEnabled?: boolean;
}) {
  return (
    <div className="pm-tray" data-jeton-tray="true">
      <div className="pm-tray-meta">
        <div>
          <small>YOUR JETONS</small>
        </div>
        <div>
          <small>AVAILABLE</small>
          <strong>{available}</strong>
        </div>
      </div>
      <div className="pm-tray-chips">
        {CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={`pm-tray-chip ${chip.className}`}
            disabled={!trayEnabled}
            aria-label={`Add ${chip.value} jetons`}
            onClick={() => onChip?.(chip.value)}
          >
            {chip.value}
          </button>
        ))}
      </div>
      {onPlaceBet ? (
        <div className="pm-tray-actions">
          <input className="pm-input" placeholder="Amount" disabled={!trayEnabled} readOnly aria-label="Amount" />
          <button
            type="button"
            className="pm-btn is-primary"
            disabled={!placeBetEnabled}
            onClick={onPlaceBet}
          >
            PLACE BET
          </button>
        </div>
      ) : null}
    </div>
  );
}
