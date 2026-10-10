"use client";

import type { ReactNode } from "react";
import type { DockAction } from "./CasinoDock";

const CHIPS = [
  { value: "5", className: "is-5" },
  { value: "10", className: "is-10" },
  { value: "25", className: "is-25" },
  { value: "50", className: "is-50" },
  { value: "100", className: "is-100" },
] as const;

export function CasinoConsole({
  primary,
  secondary,
  notice,
  toCall,
  available,
  trayEnabled = false,
  selectedChip,
  onChip,
  showTray = false,
  reserveTray = false,
  children,
}: {
  primary?: DockAction | null;
  secondary?: DockAction | null;
  notice?: ReactNode;
  toCall?: string | null;
  available?: string;
  trayEnabled?: boolean;
  selectedChip?: string | null;
  onChip?: (value: string) => void;
  showTray?: boolean;
  /** Keep tray row height even when chips are hidden (geometry lock). */
  reserveTray?: boolean;
  children?: ReactNode;
}) {
  const hasActions = Boolean(primary || secondary);
  const trayVisible = showTray;
  return (
    <footer className="pm-console" data-premium-dock="true" data-casino-console="true">
      <div className="pm-console-body">
        {notice}
        <div className="pm-console-top">
          {toCall != null && toCall !== "0" ? (
            <div className="pm-console-call" data-to-call="true">
              TO CALL <strong>{toCall}</strong>
            </div>
          ) : (
            <span />
          )}
          {available != null ? (
            <div className="pm-console-wallet" data-player-wallet="true">
              <small>AVAILABLE</small>
              <strong>{available}</strong>
            </div>
          ) : (
            <span />
          )}
        </div>
        <div className={`pm-console-actions${hasActions ? "" : " is-empty"}${primary && !secondary ? " is-single" : ""}`}>
          {primary ? (
            <button
              type="button"
              className="pm-console-btn is-primary"
              disabled={primary.disabled}
              onClick={primary.onClick}
            >
              {primary.label}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              className="pm-console-btn is-ghost"
              disabled={secondary.disabled}
              onClick={secondary.onClick}
            >
              {secondary.label}
            </button>
          ) : null}
        </div>
        {children}
        {(trayVisible || reserveTray) && (
          <div className={`pm-console-tray${trayVisible ? "" : " is-reserved"}`} data-jeton-tray="true">
            {trayVisible
              ? CHIPS.map((chip) => {
                  const selected = selectedChip === chip.value;
                  return (
                    <button
                      key={chip.value}
                      type="button"
                      className={`pm-console-chip ${chip.className}${selected ? " is-selected" : ""}`}
                      disabled={!trayEnabled}
                      aria-label={`Add ${chip.value} jetons`}
                      aria-pressed={selected}
                      onClick={() => onChip?.(chip.value)}
                    >
                      <span className="pm-console-chip-face">{chip.value}</span>
                    </button>
                  );
                })
              : null}
          </div>
        )}
      </div>
    </footer>
  );
}
