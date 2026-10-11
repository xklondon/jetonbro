"use client";

import type { ReactNode } from "react";
import type { DockAction } from "./CasinoDock";
import { CasinoJeton } from "./CasinoJeton";

const CHIPS = ["5", "10", "25", "50", "100"] as const;

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
  variant = "default",
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
  reserveTray?: boolean;
  /** blackjack/setup: compact action row; default: poker live layout */
  variant?: "default" | "blackjack" | "setup";
  children?: ReactNode;
}) {
  const trayVisible = showTray;
  const compact = variant === "blackjack" || variant === "setup";
  const hasTray = trayVisible || reserveTray;

  return (
    <footer
      className={`pm-console${compact ? " is-bj" : ""}${variant === "setup" ? " is-setup" : ""}`}
      data-premium-dock="true"
      data-casino-console="true"
      data-console-variant={variant}
      data-has-tray={hasTray ? "true" : "false"}
    >
      <div className={`pm-console-body${hasTray ? " has-tray" : " no-tray"}`}>
        {notice}
        {compact ? (
          <div
            className={`pm-console-action-row${variant === "setup" ? " is-setup-order" : ""}`}
            data-console-actions="true"
          >
            {variant === "setup" ? (
              <>
                <div className="pm-console-slot is-primary">
                  {primary ? (
                    <button
                      type="button"
                      className="pm-console-btn is-primary"
                      disabled={primary.disabled}
                      onClick={primary.onClick}
                      data-start-hand={primary.label === "START HAND" ? "true" : undefined}
                    >
                      {primary.label}
                    </button>
                  ) : null}
                </div>
                <div className="pm-console-slot is-secondary">
                  {secondary ? (
                    <button
                      type="button"
                      className="pm-console-btn is-ghost"
                      disabled={secondary.disabled}
                      onClick={secondary.onClick}
                      aria-label={secondary.label}
                      data-add-player-dock={secondary.label === "ADD PLAYER" ? "true" : undefined}
                    >
                      {secondary.label}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className="pm-console-slot is-secondary">
                  {secondary ? (
                    <button
                      type="button"
                      className="pm-console-btn is-ghost"
                      disabled={secondary.disabled}
                      onClick={secondary.onClick}
                      aria-label={secondary.label}
                      data-add-player-dock={secondary.label === "ADD PLAYER" ? "true" : undefined}
                    >
                      {secondary.label}
                    </button>
                  ) : null}
                </div>
                <div className="pm-console-slot is-primary">
                  {primary ? (
                    <button
                      type="button"
                      className="pm-console-btn is-primary"
                      disabled={primary.disabled}
                      onClick={primary.onClick}
                      data-start-hand={primary.label === "START HAND" ? "true" : undefined}
                    >
                      {primary.label}
                    </button>
                  ) : null}
                </div>
              </>
            )}
            <div className="pm-console-slot is-wallet" data-player-wallet="true">
              {available != null ? (
                <>
                  <small>AVAILABLE</small>
                  <strong>{available}</strong>
                </>
              ) : (
                <span className="pm-console-wallet-spacer" aria-hidden="true" />
              )}
            </div>
          </div>
        ) : (
          <>
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
            <div
              className={`pm-console-actions${primary || secondary ? "" : " is-empty"}${
                primary && !secondary ? " is-single" : ""
              }`}
            >
              {primary ? (
                <button
                  type="button"
                  className="pm-console-btn is-primary"
                  disabled={primary.disabled}
                  onClick={primary.onClick}
                  data-start-hand={primary.label === "START HAND" ? "true" : undefined}
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
                  aria-label={secondary.label}
                  data-add-player-dock={secondary.label === "ADD PLAYER" ? "true" : undefined}
                >
                  {secondary.label}
                </button>
              ) : null}
            </div>
          </>
        )}
        {children}
        {hasTray ? (
          <div className={`pm-console-tray${trayVisible ? "" : " is-reserved"}`} data-jeton-tray="true">
            {trayVisible
              ? CHIPS.map((value) => {
                  const selected = selectedChip === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      className={`pm-console-jeton-btn${selected ? " is-selected" : ""}`}
                      disabled={!trayEnabled}
                      aria-label={`Add ${value} jetons`}
                      aria-pressed={selected}
                      onClick={() => onChip?.(value)}
                    >
                      <CasinoJeton
                        denomination={value}
                        size={variant === "blackjack" ? "xl" : "lg"}
                        selected={selected}
                        disabled={!trayEnabled}
                        label={value}
                      />
                    </button>
                  );
                })
              : null}
          </div>
        ) : null}
      </div>
    </footer>
  );
}
