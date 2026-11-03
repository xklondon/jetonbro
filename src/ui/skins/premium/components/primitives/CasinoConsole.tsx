"use client";

import type { ReactNode } from "react";
import type { DockAction } from "./CasinoDock";
import { CasinoJeton } from "./CasinoJeton";

const CHIPS = ["5", "10", "25", "50", "100"] as const;

function pokerActionTone(label: string): string {
  const upper = label.toUpperCase();
  if (upper.includes("ALL IN") || upper.startsWith("CONFIRM ALL")) return " is-allin";
  if (upper.startsWith("FOLD")) return " is-fold";
  if (upper.startsWith("CHECK")) return " is-check";
  if (upper.startsWith("BET") || upper.startsWith("RAISE") || upper.startsWith("CONFIRM")) return " is-bet";
  if (upper.startsWith("CALL")) return " is-call";
  return "";
}

function ActionButton({
  action,
  kind,
  allIn = false,
}: {
  action: DockAction;
  kind: "primary" | "ghost";
  allIn?: boolean;
}) {
  const tone = pokerActionTone(action.label);
  const isAllIn = allIn || tone === " is-allin";
  return (
    <button
      type="button"
      className={`pm-console-btn is-${kind === "primary" ? "primary" : "ghost"}${tone}${isAllIn ? " is-compact-allin" : ""}`}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
      aria-label={action.title && action.disabled ? `${action.label}. ${action.title}` : action.label}
      data-start-hand={action.label === "START HAND" ? "true" : undefined}
      data-add-player-dock={action.label === "ADD PLAYER" ? "true" : undefined}
      data-change-game={action.label === "CHANGE GAME" ? "true" : undefined}
      data-poker-confirm={action.label.toUpperCase().startsWith("CONFIRM") ? "true" : undefined}
      data-poker-all-in={isAllIn ? "true" : undefined}
    >
      {isAllIn ? (
        <span className="pm-console-allin-label">
          <span className="pm-console-allin-skull" aria-hidden="true">
            ☠
          </span>
          <span>{action.label}</span>
        </span>
      ) : (
        action.label
      )}
    </button>
  );
}

function TrayChips({
  trayEnabled,
  selectedChip,
  minChipAmount,
  onChip,
  composeKind,
}: {
  trayEnabled: boolean;
  selectedChip?: string | null;
  minChipAmount?: number | null;
  onChip?: (value: string) => void;
  composeKind?: "RAISE" | "BET" | null;
}) {
  return (
    <div className="pm-console-tray-chips">
      {CHIPS.map((value) => {
        const selected = selectedChip === value;
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
                  ? `Adds ${value} toward min total ${minChipAmount}`
                  : composeKind
                    ? `Add ${value} toward street wager total`
                    : `Add ${value} jetons`
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
  );
}

export function CasinoConsole({
  primary,
  secondary,
  tertiary,
  allIn = null,
  notice,
  turnStatus = null,
  toCall,
  available,
  trayEnabled = false,
  selectedChip,
  composeOpen = false,
  composeKind = null,
  composeAmount = "",
  raiseToPreview = null,
  additionalPreview = null,
  committedPreview = null,
  onComposeAmount,
  onChip,
  minChipAmount = null,
  maxChipAmount = null,
  showTray = false,
  reserveTray = false,
  variant = "default",
  children,
}: {
  primary?: DockAction | null;
  secondary?: DockAction | null;
  tertiary?: DockAction | null;
  /** Compact ALL IN control (skull) beside RAISE / CALL / FOLD. */
  allIn?: DockAction | null;
  notice?: ReactNode;
  turnStatus?: string | null;
  toCall?: string | null;
  available?: string;
  trayEnabled?: boolean;
  selectedChip?: string | null;
  /** RAISE/BET compose — row is always reserved; active when composeOpen. */
  composeOpen?: boolean;
  composeKind?: "RAISE" | "BET" | null;
  composeAmount?: string;
  /** Target street wager total (raise-to / bet). */
  raiseToPreview?: string | null;
  /** Extra jetons leaving AVAILABLE this action (target − streetContribution). */
  additionalPreview?: string | null;
  /** Already committed on this street (blinds / prior bets). */
  committedPreview?: string | null;
  onComposeAmount?: (value: string) => void;
  onChip?: (value: string) => void;
  minChipAmount?: number | null;
  maxChipAmount?: number | null;
  showTray?: boolean;
  reserveTray?: boolean;
  variant?: "default" | "blackjack" | "setup";
  children?: ReactNode;
}) {
  const trayVisible = showTray;
  const compact = variant === "blackjack" || variant === "setup";
  const hasTray = trayVisible || (reserveTray && variant === "default");
  const showWallet = available != null;
  /** AVAILABLE sits beside jetons whenever the tray is visible (BJ + Poker). */
  const walletInTray = showWallet && trayVisible;
  const walletAboveTray = showWallet && compact && !trayVisible;
  const actionCount = [allIn, primary, secondary, tertiary].filter(Boolean).length;
  const showCall = toCall != null && toCall !== "0";
  /** Always reserve the status strip in poker so tray height does not jump. */
  const stripHead = !compact;
  const composeActive = !compact && composeOpen;
  const raiseCompose = composeActive && composeKind === "RAISE";

  return (
    <footer
      className={`pm-console${compact ? " is-bj" : " is-poker-wallet"}${variant === "setup" ? " is-setup" : ""}${
        trayVisible ? " has-visible-tray" : " no-visible-tray"
      }${stripHead ? " has-strip-head" : ""}${composeActive ? " has-compose" : ""}`}
      data-premium-dock="true"
      data-casino-console="true"
      data-console-variant={variant}
      data-has-tray={hasTray ? "true" : "false"}
      data-poker-wallet={!compact ? "true" : undefined}
      data-action-strip={stripHead || (!compact && actionCount > 0) ? "true" : undefined}
      data-raise-compose={composeActive ? composeKind ?? "true" : "reserved"}
      data-pending-bet={composeActive && composeAmount ? composeAmount : undefined}
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
            {trayVisible ? (
              <div
                className={`pm-console-tray${walletInTray ? " has-available" : ""}`}
                data-jeton-tray="true"
              >
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
                <TrayChips
                  trayEnabled={trayEnabled}
                  selectedChip={selectedChip}
                  minChipAmount={minChipAmount}
                  onChip={onChip}
                  composeKind={composeKind}
                />
              </div>
            ) : null}
          </>
        ) : (
          /* Fixed rows: status → compose → ALL IN|RAISE|CALL|FOLD → jetons + AVAILABLE. */
          <div className="pm-poker-wallet-stack" data-poker-wallet-stack="true">
            {stripHead ? (
              <div
                className={`pm-console-strip-head${showCall || turnStatus ? "" : " is-spacer"}`}
                data-action-strip-head="true"
                data-tray-turn-top="true"
                aria-hidden={showCall || turnStatus ? undefined : true}
              >
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
              className={`pm-console-compose-slot${composeActive ? " is-active" : " is-reserved"}`}
              data-raise-slot="true"
              data-raise-input={composeActive ? "true" : undefined}
              aria-hidden={composeActive ? undefined : true}
            >
              {composeActive ? (
                <div className="pm-console-compose">
                  <div className="pm-console-compose-meta">
                    <small>{raiseCompose ? "RAISE TO" : composeKind === "BET" ? "BET" : "RAISE TO"}</small>
                    {committedPreview && committedPreview !== "0" ? (
                      <span className="pm-console-compose-committed" data-raise-committed={committedPreview}>
                        IN {committedPreview}
                      </span>
                    ) : null}
                    {additionalPreview ? (
                      <span className="pm-console-compose-add" data-raise-additional={additionalPreview}>
                        ADD {additionalPreview}
                      </span>
                    ) : null}
                    {raiseToPreview ? (
                      <span className="pm-console-compose-preview" data-raise-to-preview={raiseToPreview}>
                        TOTAL {raiseToPreview}
                      </span>
                    ) : null}
                    {minChipAmount != null ? (
                      <span className="pm-console-compose-min" data-raise-min={String(minChipAmount)}>
                        MIN {minChipAmount}
                      </span>
                    ) : null}
                    {maxChipAmount != null ? (
                      <span className="pm-console-compose-max" data-raise-max={String(maxChipAmount)}>
                        MAX {maxChipAmount}
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    autoComplete="off"
                    className="pm-console-compose-field"
                    value={composeAmount}
                    placeholder={minChipAmount != null ? String(minChipAmount) : "0"}
                    aria-label={raiseCompose ? "Raise to total" : composeKind === "BET" ? "Bet amount" : "Raise to total"}
                    data-compose-amount="true"
                    onChange={(event) => onComposeAmount?.(event.target.value)}
                  />
                </div>
              ) : (
                <div className="pm-console-compose is-placeholder" />
              )}
            </div>
            <div
              className={`pm-poker-action-bar${actionCount === 0 ? " is-status-only" : ""}`}
              data-poker-action-bar="true"
            >
              <div
                className={`pm-console-actions${primary || secondary || tertiary || allIn ? "" : " is-empty"}${
                  primary && !secondary && !tertiary && !allIn ? " is-single" : ""
                }${secondary && primary && tertiary && !allIn ? " is-trio" : ""}${
                  allIn && (primary || secondary || tertiary) ? " is-quad" : ""
                }`}
                data-console-actions="true"
              >
                {allIn ? <ActionButton action={allIn} kind="ghost" allIn /> : null}
                {tertiary ? <ActionButton action={tertiary} kind="ghost" /> : null}
                {primary ? <ActionButton action={primary} kind="primary" /> : null}
                {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
              </div>
            </div>
            {trayVisible ? (
              <div
                className={`pm-console-tray${walletInTray ? " has-available" : ""}`}
                data-jeton-tray="true"
              >
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
                <TrayChips
                  trayEnabled={trayEnabled}
                  selectedChip={selectedChip}
                  minChipAmount={minChipAmount}
                  onChip={onChip}
                  composeKind={composeKind}
                />
              </div>
            ) : (
              <div className="pm-console-tray is-height-reserve" data-jeton-tray="reserved" aria-hidden="true" />
            )}
          </div>
        )}
        {children}
      </div>
    </footer>
  );
}
