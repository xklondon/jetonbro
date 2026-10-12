"use client";

import type { ReactNode } from "react";
import type { DockAction } from "./CasinoDock";
import { CasinoJeton } from "./CasinoJeton";

const CHIPS = ["5", "10", "25", "50", "100"] as const;

function ActionButton({
  action,
  kind,
}: {
  action: DockAction;
  kind: "primary" | "ghost";
}) {
  return (
    <button
      type="button"
      className={`pm-console-btn is-${kind === "primary" ? "primary" : "ghost"}`}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
      aria-label={action.title && action.disabled ? `${action.label}. ${action.title}` : action.label}
      data-start-hand={action.label === "START HAND" ? "true" : undefined}
      data-add-player-dock={action.label === "ADD PLAYER" ? "true" : undefined}
      data-change-game={action.label === "CHANGE GAME" ? "true" : undefined}
    >
      {action.label}
    </button>
  );
}

export function CasinoConsole({
  primary,
  secondary,
  tertiary,
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
  /** Optional third compact control (e.g. CHANGE GAME on dealer setup). */
  tertiary?: DockAction | null;
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
  /** Only reserve empty tray height for Poker live — BJ dealer must not show a hollow betting well. */
  const hasTray = trayVisible || (reserveTray && variant === "default");
  const showWallet = available != null;
  const actionCount = [primary, secondary, tertiary].filter(Boolean).length;

  return (
    <footer
      className={`pm-console${compact ? " is-bj" : ""}${variant === "setup" ? " is-setup" : ""}${
        trayVisible ? " has-visible-tray" : " no-visible-tray"
      }`}
      data-premium-dock="true"
      data-casino-console="true"
      data-console-variant={variant}
      data-has-tray={hasTray ? "true" : "false"}
    >
      <div className={`pm-console-body${hasTray || trayVisible ? " has-tray" : " no-tray"}`}>
        {notice}
        {compact ? (
          <>
            <div
              className={`pm-console-action-row${variant === "setup" ? " is-setup-order" : ""}${
                actionCount <= 1 ? " is-single" : ""
              }${actionCount >= 3 ? " is-triple" : ""}`}
              data-console-actions="true"
            >
              {variant === "setup" ? (
                <>
                  <div className="pm-console-slot is-primary">
                    {primary ? <ActionButton action={primary} kind="primary" /> : null}
                  </div>
                  <div className="pm-console-slot is-secondary">
                    {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
                  </div>
                  {tertiary ? (
                    <div className="pm-console-slot is-tertiary">
                      <ActionButton action={tertiary} kind="ghost" />
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  {tertiary ? (
                    <div className="pm-console-slot is-tertiary">
                      <ActionButton action={tertiary} kind="ghost" />
                    </div>
                  ) : null}
                  <div className="pm-console-slot is-secondary">
                    {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
                  </div>
                  <div className="pm-console-slot is-primary">
                    {primary ? <ActionButton action={primary} kind="primary" /> : null}
                  </div>
                </>
              )}
            </div>
            {showWallet ? (
              <div className="pm-console-available" data-player-wallet="true">
                <span className="pm-console-available-rule" aria-hidden="true" />
                <div className="pm-console-available-copy">
                  <small>AVAILABLE</small>
                  <strong>{available}</strong>
                </div>
                <span className="pm-console-available-rule" aria-hidden="true" />
              </div>
            ) : null}
          </>
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
              {showWallet ? (
                <div className="pm-console-wallet" data-player-wallet="true">
                  <small>AVAILABLE</small>
                  <strong>{available}</strong>
                </div>
              ) : (
                <span />
              )}
            </div>
            <div
              className={`pm-console-actions${primary || secondary || tertiary ? "" : " is-empty"}${
                primary && !secondary && !tertiary ? " is-single" : ""
              }`}
            >
              {tertiary ? <ActionButton action={tertiary} kind="ghost" /> : null}
              {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
              {primary ? <ActionButton action={primary} kind="primary" /> : null}
            </div>
          </>
        )}
        {children}
        {trayVisible ? (
          <div className="pm-console-tray" data-jeton-tray="true">
            {CHIPS.map((value) => {
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
            })}
          </div>
        ) : hasTray ? (
          <div className="pm-console-tray is-reserved" data-jeton-tray="true" aria-hidden="true" />
        ) : null}
      </div>
    </footer>
  );
}
