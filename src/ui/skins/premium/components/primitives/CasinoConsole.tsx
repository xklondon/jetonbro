"use client";

import type { ReactNode } from "react";
import type { DockAction } from "./CasinoDock";
import { CasinoJeton } from "./CasinoJeton";

const CHIPS = ["5", "10", "25", "50", "100"] as const;

function pokerActionTone(label: string): string {
  const upper = label.toUpperCase();
  if (upper.startsWith("FOLD")) return " is-fold";
  if (upper.startsWith("CHECK")) return " is-check";
  if (upper.startsWith("BET") || upper.startsWith("RAISE") || upper.startsWith("CONFIRM")) return " is-bet";
  if (upper.startsWith("CALL")) return " is-call";
  return "";
}

function ActionButton({
  action,
  kind,
}: {
  action: DockAction;
  kind: "primary" | "ghost";
}) {
  const tone = pokerActionTone(action.label);
  return (
    <button
      type="button"
      className={`pm-console-btn is-${kind === "primary" ? "primary" : "ghost"}${tone}`}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
      aria-label={action.title && action.disabled ? `${action.label}. ${action.title}` : action.label}
      data-start-hand={action.label === "START HAND" ? "true" : undefined}
      data-add-player-dock={action.label === "ADD PLAYER" ? "true" : undefined}
      data-change-game={action.label === "CHANGE GAME" ? "true" : undefined}
      data-poker-confirm={action.label.toUpperCase().startsWith("CONFIRM") ? "true" : undefined}
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
  turnStatus = null,
  toCall,
  available,
  trayEnabled = false,
  selectedChip,
  pendingChips,
  pendingTotal,
  onChip,
  minChipAmount = null,
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
  /** Poker live strip: YOUR TURN / TURN · Name — shares one row with TO CALL. */
  turnStatus?: string | null;
  toCall?: string | null;
  available?: string;
  trayEnabled?: boolean;
  selectedChip?: string | null;
  /** Poker: accumulated tray chip faces (click adds; does not submit). */
  pendingChips?: string[];
  pendingTotal?: string | null;
  onChip?: (value: string) => void;
  /** Informational min for Confirm — individual chips stay clickable when tray is live. */
  minChipAmount?: number | null;
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
  /** Poker: AVAILABLE sits on the chip row. BJ compact keeps the centered AVAILABLE band. */
  const walletInTray = showWallet && !compact;
  const walletAboveTray = showWallet && compact;
  const actionCount = [primary, secondary, tertiary].filter(Boolean).length;
  const showCall = toCall != null && toCall !== "0";
  const stripHead = !compact && (showCall || Boolean(turnStatus));
  const accumulateMode = pendingChips != null;
  const pending = pendingChips ?? [];
  const showPending = accumulateMode && pending.length > 0;

  return (
    <footer
      className={`pm-console${compact ? " is-bj" : " is-poker-wallet"}${variant === "setup" ? " is-setup" : ""}${
        trayVisible ? " has-visible-tray" : " no-visible-tray"
      }${stripHead ? " has-strip-head" : ""}${showPending ? " has-pending-bet" : ""}`}
      data-premium-dock="true"
      data-casino-console="true"
      data-console-variant={variant}
      data-has-tray={hasTray ? "true" : "false"}
      data-poker-wallet={!compact ? "true" : undefined}
      data-action-strip={stripHead || (!compact && actionCount > 0) ? "true" : undefined}
      data-pending-bet={showPending ? pendingTotal ?? String(pending.length) : undefined}
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
            {walletAboveTray ? (
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
          /* Poker: action bar (turn + options) layered above the jeton row. */
          <div className="pm-poker-wallet-stack" data-poker-wallet-stack="true">
            <div
              className={`pm-poker-action-bar${actionCount === 0 ? " is-status-only" : ""}`}
              data-poker-action-bar="true"
            >
              {stripHead ? (
                <div className="pm-console-strip-head" data-action-strip-head="true">
                  {showCall ? (
                    <div className="pm-console-call" data-to-call="true">
                      TO CALL <strong>{toCall}</strong>
                    </div>
                  ) : (
                    <span className="pm-console-strip-spacer" aria-hidden="true" />
                  )}
                  {turnStatus ? (
                    <div className="pm-console-turn" data-poker-turn-hint="true">
                      {turnStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div
                className={`pm-console-actions${primary || secondary || tertiary ? "" : " is-empty"}${
                  primary && !secondary && !tertiary ? " is-single" : ""
                }${secondary && primary && tertiary ? " is-trio" : ""}`}
                data-console-actions="true"
              >
                {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
                {primary ? <ActionButton action={primary} kind="primary" /> : null}
                {tertiary ? <ActionButton action={tertiary} kind="ghost" /> : null}
              </div>
            </div>
            {trayVisible ? (
              <div
                className={`pm-console-tray${walletInTray ? " has-available" : ""}${
                  showPending ? " has-pending" : ""
                }`}
                data-jeton-tray="true"
              >
                {showPending ? (
                  <div
                    className="pm-console-pending"
                    data-pending-stack="true"
                    aria-label={`Pending wager ${pendingTotal ?? ""}`}
                  >
                    <small>PENDING</small>
                    <div className="pm-console-pending-chips">
                      {pending.map((face, index) => (
                        <span key={`${face}-${index}`} className="pm-console-pending-chip">
                          <CasinoJeton denomination={face} size="sm" label={face} />
                        </span>
                      ))}
                    </div>
                    <strong data-pending-total={pendingTotal ?? undefined}>{pendingTotal}</strong>
                  </div>
                ) : null}
                {walletInTray ? (
                  <div
                    className="pm-console-tray-available"
                    data-player-wallet="true"
                    data-tray-available="true"
                  >
                    <small>AVAILABLE</small>
                    <strong>{available}</strong>
                  </div>
                ) : null}
                <div className="pm-console-tray-chips">
                  {CHIPS.map((value) => {
                    const selected = !accumulateMode && selectedChip === value;
                    const chipDisabled = !trayEnabled;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`pm-console-jeton-btn${selected ? " is-selected" : ""}`}
                        disabled={chipDisabled}
                        aria-label={`Add ${value} jetons`}
                        aria-pressed={selected}
                        title={
                          chipDisabled
                            ? "Waiting for your turn"
                            : minChipAmount != null && Number(value) < minChipAmount
                              ? `Adds ${value} toward min ${minChipAmount}`
                              : `Add ${value} to pending wager`
                        }
                        onClick={() => onChip?.(value)}
                      >
                        <CasinoJeton
                          denomination={value}
                          size="md"
                          selected={selected}
                          disabled={chipDisabled}
                          label={value}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
        {children}
        {hasTray && compact ? (
          <div className="pm-console-tray is-reserved has-available" data-jeton-tray="true" aria-hidden="true" />
        ) : null}
      </div>
    </footer>
  );
}
