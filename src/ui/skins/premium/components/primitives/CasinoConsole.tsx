"use client";

import type { ReactNode } from "react";
import { formatPokerTurnStatus } from "../pokerTurnStatus";
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

/** Blackjack dealer progression colour key — mirrors existing action labels. */
function blackjackPhaseAction(label: string): string | undefined {
  const upper = label.toUpperCase();
  if (upper === "START HAND") return "start-hand";
  if (upper.includes("START BETTING") || upper.includes("OPEN BETTING")) return "start-betting";
  if (upper.includes("DEAL CARDS") || upper.startsWith("START CARDS")) return "deal-cards";
  if (upper.includes("ENTER PAYOUT") || upper.includes("START PAYOUT") || upper === "SETTLE") {
    return "enter-payout";
  }
  if (upper.includes("NEXT ROUND") || upper.includes("START NEXT")) return "next-round";
  return undefined;
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
  const phaseAction = blackjackPhaseAction(action.label);
  return (
    <button
      type="button"
      className={`pm-console-btn is-${kind === "primary" ? "primary" : "ghost"}${tone}${isAllIn ? " is-compact-allin" : ""}`}
      disabled={action.disabled}
      title={action.title}
      onClick={action.onClick}
      aria-label={action.title && action.disabled ? `${action.label}. ${action.title}` : action.label}
      data-start-hand={action.label === "START HAND" || action.label === "START BETTING" ? "true" : undefined}
      data-bj-phase-action={phaseAction}
      data-bj-bets-ready={
        phaseAction === "deal-cards" && action.betsReady != null
          ? action.betsReady
            ? "true"
            : "false"
          : undefined
      }
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
  composeLocked = false,
  composeLabel = null,
  pendingChips: _pendingChips = null,
  onRemovePendingChip: _onRemovePendingChip,
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
  playerSlots = false,
  trayCards = null,
  statusAction = null,
  statusMessage = null,
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
  /** RAISE/BET compose — content-height single row when composeOpen; collapsed otherwise. */
  composeOpen?: boolean;
  composeKind?: "RAISE" | "BET" | null;
  composeAmount?: string;
  /** Confirmed box stake — composer is read-only until the next betting round. */
  composeLocked?: boolean;
  /** Blackjack pending label (YOUR BET). */
  composeLabel?: string | null;
  /** Pending chip faces before PLACE BET — each may expose × removal. */
  pendingChips?: string[] | null;
  onRemovePendingChip?: (index: number) => void;
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
  /**
   * Blackjack player only — permanent LEFT / CENTRE / RIGHT action slots;
   * Card Assist sits on the YOUR BET row (never overlaps amount).
   */
  playerSlots?: boolean;
  /** Compact YOUR CARDS / ADD CARDS strip (BJ player: bet row; dealer: action row). */
  trayCards?: ReactNode;
  /** Dealer DEAL HAND — compact control in the status row (not a second tray row). */
  statusAction?: DockAction | null;
  /** BJ player TABLE_SETUP waiting copy — upper tray, jetons stay pinned. */
  statusMessage?: string | null;
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
  const turnHint = !compact ? formatPokerTurnStatus(turnStatus, toCall) : turnStatus;
  const single = actionCount === 1;
  const duo = actionCount === 2;
  const trio = actionCount === 3;
  const quad = actionCount === 4;

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
            {statusMessage ? (
              <div className="pm-bj-waiting-banner" data-bj-waiting-banner="true">
                {statusMessage}
              </div>
            ) : null}
            {playerSlots && !statusMessage ? (
              <>
                <div
                  className="pm-console-action-row is-bj-player-trio"
                  data-console-actions="true"
                  data-bj-player-slots="true"
                >
                  <div className="pm-console-slot is-secondary" data-bj-slot="left">
                    {secondary ? (
                      <ActionButton action={secondary} kind="ghost" />
                    ) : tertiary ? (
                      <ActionButton action={tertiary} kind="ghost" />
                    ) : null}
                  </div>
                  <div className="pm-console-slot is-primary" data-bj-slot="centre">
                    {primary ? <ActionButton action={primary} kind="primary" /> : null}
                  </div>
                  <div className="pm-console-slot is-allin" data-bj-slot="right">
                    {allIn ? <ActionButton action={allIn} kind="ghost" allIn /> : null}
                  </div>
                </div>
                <div className="pm-bj-bet-cards-row" data-bj-bet-cards-row="true">
                  <div
                    className={`pm-bj-pending-bet${composeLocked ? " is-locked" : ""}${
                      !(onComposeAmount || composeLocked) ? " is-placeholder" : ""
                    }`}
                    data-bj-pending-bet="true"
                    data-bj-pending-wager="true"
                  >
                    <span className="pm-bj-pending-bet-label">{composeLabel ?? "YOUR BET"}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={composeLocked ? "Confirmed bet" : "Your bet"}
                      value={onComposeAmount || composeLocked ? composeAmount : ""}
                      placeholder="0"
                      disabled={!trayEnabled || composeLocked || !onComposeAmount}
                      readOnly={composeLocked || !onComposeAmount}
                      onChange={(event) => onComposeAmount?.(event.target.value)}
                    />
                  </div>
                  <div className="pm-bj-inline-cards" data-bj-inline-cards="true">
                    {trayCards}
                  </div>
                </div>
              </>
            ) : actionCount > 0 || trayCards ? (
              <div
                className={`pm-console-action-row${actionCount <= 1 ? " is-single" : ""}${
                  actionCount >= 3 ? " is-triple" : ""
                }${trayCards ? " has-inline-cards" : ""}`}
                data-console-actions="true"
              >
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
                  {allIn ? (
                    <div className="pm-console-slot is-allin">
                      <ActionButton action={allIn} kind="ghost" allIn />
                    </div>
                  ) : null}
                  {trayCards ? (
                    <div className="pm-console-slot is-cards" data-bj-inline-cards="true">
                      {trayCards}
                    </div>
                  ) : null}
                </>
              </div>
            ) : null}
            {!playerSlots && variant === "blackjack" && (onComposeAmount || composeLocked) ? (
              <div
                className={`pm-bj-pending-bet${composeLocked ? " is-locked" : ""}`}
                data-bj-pending-bet="true"
                data-bj-pending-wager="true"
              >
                <span className="pm-bj-pending-bet-label">{composeLabel ?? "YOUR BET"}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={composeLocked ? "Confirmed bet" : "Your bet"}
                  value={composeAmount}
                  placeholder="0"
                  disabled={!trayEnabled || composeLocked}
                  readOnly={composeLocked || !onComposeAmount}
                  onChange={(event) => onComposeAmount?.(event.target.value)}
                />
              </div>
            ) : null}
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
          /* Fixed-height casino console: status+compose → actions → jetons → cards. */
          <div className="pm-poker-wallet-stack" data-poker-wallet-stack="true" data-poker-tray-fixed="true">
            <div
              className={`pm-console-strip-head${composeActive ? " has-compose" : ""}`}
              data-action-strip-head="true"
              data-tray-turn-top="true"
              data-raise-slot="true"
              data-raise-input={composeActive ? "true" : undefined}
            >
              {turnHint ? (
                <div className="pm-console-turn" data-poker-turn-hint="true">
                  <span className="pm-console-turn-mark" aria-hidden="true">
                    ♠
                  </span>
                  {turnHint}
                </div>
              ) : (
                <span className="pm-console-strip-spacer" aria-hidden="true" />
              )}
              {statusAction && !composeActive ? (
                <button
                  type="button"
                  className="pm-console-status-action"
                  disabled={statusAction.disabled}
                  title={statusAction.title}
                  onClick={statusAction.onClick}
                  data-deal-hand="true"
                  data-start-hand={
                    statusAction.label === "DEAL HAND" || statusAction.label === "START HAND" ? "true" : undefined
                  }
                >
                  {statusAction.label}
                </button>
              ) : null}
              <div
                className={`pm-console-compose-slot${composeActive ? " is-active" : " is-reserved"}`}
                data-compose-slot="true"
                aria-hidden={composeActive ? undefined : true}
              >
                {composeActive ? (
                  <div className="pm-console-compose is-inline-row" data-compose-row="true">
                    <span className="pm-console-compose-kind" data-compose-kind="true">
                      <span className="pm-console-compose-chip-mark" aria-hidden="true">
                        ◆
                      </span>
                      {raiseCompose ? "RAISE TO" : composeKind === "BET" ? "BET" : "RAISE TO"}
                    </span>
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
                    <span
                      className="pm-console-compose-add"
                      data-raise-additional={additionalPreview ?? undefined}
                    >
                      +{additionalPreview && additionalPreview !== "0" ? additionalPreview : "0"} TO PAY
                    </span>
                    {raiseToPreview ? (
                      <span data-raise-to-preview={raiseToPreview} hidden>
                        {raiseToPreview}
                      </span>
                    ) : null}
                    {minChipAmount != null ? (
                      <span className="pm-console-compose-min" data-raise-min={String(minChipAmount)} hidden>
                        MIN {minChipAmount}
                      </span>
                    ) : null}
                    {maxChipAmount != null ? (
                      <span className="pm-console-compose-max" data-raise-max={String(maxChipAmount)} hidden>
                        MAX {maxChipAmount}
                      </span>
                    ) : null}
                    {committedPreview && committedPreview !== "0" ? (
                      <span className="pm-console-compose-committed" data-raise-committed={committedPreview} hidden>
                        IN {committedPreview}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {toCall != null ? (
                <span data-to-call="true" hidden>
                  TO CALL {toCall}
                </span>
              ) : null}
            </div>
            <div
              className={`pm-poker-action-bar${actionCount === 0 ? " is-status-only" : ""}`}
              data-poker-action-bar="true"
            >
              <div
                className={`pm-console-actions${primary || secondary || tertiary || allIn ? "" : " is-empty"}${
                  single ? " is-single" : ""
                }${duo ? " is-duo" : ""}${trio ? " is-trio" : ""}${quad ? " is-quad" : ""}`}
                data-console-actions="true"
              >
                {tertiary ? <ActionButton action={tertiary} kind="ghost" /> : null}
                {primary ? <ActionButton action={primary} kind="primary" /> : null}
                {secondary ? <ActionButton action={secondary} kind="ghost" /> : null}
                {allIn ? <ActionButton action={allIn} kind="ghost" allIn /> : null}
              </div>
            </div>
            <div
              className={`pm-console-tray${walletInTray ? " has-available" : ""}${
                trayVisible ? "" : " is-height-reserve"
              }`}
              data-jeton-tray={trayVisible ? "true" : "reserved"}
              aria-hidden={trayVisible ? undefined : true}
            >
              {trayVisible && walletInTray ? (
                <div
                  className="pm-console-tray-available"
                  data-player-wallet="true"
                  data-tray-available="true"
                >
                  <small>AVAILABLE</small>
                  <strong>{available}</strong>
                </div>
              ) : null}
              {trayVisible ? (
                <TrayChips
                  trayEnabled={trayEnabled}
                  selectedChip={selectedChip}
                  minChipAmount={minChipAmount}
                  onChip={onChip}
                  composeKind={composeKind}
                />
              ) : null}
            </div>
            <div className="pm-poker-cards-slot" data-poker-cards-slot="true">
              {trayCards}
            </div>
          </div>
        )}
        {children}
      </div>
    </footer>
  );
}
