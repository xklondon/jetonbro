"use client";

import { useEffect, useRef, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumShell } from "./PremiumShell";
import { DEFAULT_STAKE_MODE, PremiumStakeMode, stakeModeToPayload, type StakeModeValue } from "./PremiumStakeMode";
import { CasinoDock } from "./primitives/CasinoDock";

function limitedReserve(value?: string | null) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : BLACKJACK_TABLE_DEFAULTS.startingBank;
}

function GameIcon({ kind }: { kind: "BLACKJACK" | "POKER" }) {
  if (kind === "BLACKJACK") {
    return (
      <svg className="pm-game-icon" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="6" y="8" width="16" height="22" rx="2" fill="#f4ead5" stroke="#1a1208" />
        <text x="14" y="22" textAnchor="middle" fontSize="12" fill="#1a1208">
          A♠
        </text>
        <rect x="18" y="10" width="16" height="22" rx="2" fill="#f4ead5" stroke="#1a1208" />
        <text x="26" y="24" textAnchor="middle" fontSize="12" fill="#8b1e1e">
          A♥
        </text>
      </svg>
    );
  }
  return (
    <svg className="pm-game-icon" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="14" fill="#0a5c48" stroke="#d4b882" strokeWidth="2" />
      <circle cx="20" cy="20" r="9" fill="none" stroke="#f0d78a" strokeWidth="1.5" strokeDasharray="2 2" />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fill="#f0d78a" fontWeight="700">
        100
      </text>
    </svg>
  );
}

/**
 * Premium Create Table — same command contract as Tabletop CreateTable:
 * draft `updateSettings` / bank / assign / invite, then `finalizeSetup`.
 */
export function PremiumCreateTable({
  defaultTableName,
  notice,
  onBack,
  onCreate,
  defaultStartingJetons,
  needsHostName,
  defaultHostName,
  view,
  onCommand,
}: {
  defaultTableName: string;
  notice?: string | null;
  onBack: () => void;
  onCreate: (fields: {
    name: string;
    game: "BLACKJACK" | "POKER";
    startingJetonsPerPlayer: string;
    emails: string[];
    hostName?: string;
    cardAssist?: string;
    bankFundingMode?: string;
    startingBank?: string;
    smallBlind?: string;
    bigBlind?: string;
    seatOrder?: string;
  }) => Promise<void>;
  embedded?: boolean;
  joinUrl?: string | null;
  defaultStartingJetons?: string;
  initialEmails?: string[];
  needsHostName?: boolean;
  defaultHostName?: string;
  view?: SetupTableView | null;
  onCommand?: CommandHandler;
}) {
  const [name, setName] = useState(view?.tableName ?? defaultTableName);
  const [starting, setStarting] = useState(
    view?.startingJetonsPerPlayer.label ?? defaultStartingJetons ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const [game, setGame] = useState<"BLACKJACK" | "POKER">(view?.gameId === "POKER" ? "POKER" : "BLACKJACK");
  const [hostName, setHostName] = useState(defaultHostName ?? view?.ownerName ?? "");
  const [bankFundingMode, setBankFundingMode] = useState<"OPEN" | "LIMITED">(
    view?.bankFundingMode ?? BLACKJACK_TABLE_DEFAULTS.bankFundingMode,
  );
  const [startingBank, setStartingBank] = useState(limitedReserve(view?.startingBank?.label));
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [dealerId, setDealerId] = useState(view?.members.find((m) => m.isBankDealer)?.userId ?? "");
  const [nameDirty, setNameDirty] = useState(false);
  const [startingDirty, setStartingDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [stake, setStake] = useState<StakeModeValue>(DEFAULT_STAKE_MODE);
  const stakeRef = useRef(stake);
  stakeRef.current = stake;
  const [stakeTouched, setStakeTouched] = useState(false);

  useEffect(() => {
    if (!view) return;
    if (!nameDirty) setName(view.tableName);
    if (!startingDirty) setStarting(view.startingJetonsPerPlayer.label);
    if (view.gameId === "POKER" || view.gameId === "BLACKJACK") setGame(view.gameId);
    setBankFundingMode(view.bankFundingMode ?? "OPEN");
    if (view.bankFundingMode === "LIMITED" && view.startingBank?.label) {
      setStartingBank(limitedReserve(view.startingBank.label));
    }
    setDealerId(view.members.find((m) => m.isBankDealer)?.userId ?? "");
    const sessionStake = view.gameSession?.stakeType;
    if (!stakeTouched && (sessionStake === "FUN_ONLY" || sessionStake === "MONEY" || sessionStake === "CUSTOM")) {
      setStake((current) => ({ ...current, stakeType: sessionStake }));
    }
  }, [view, nameDirty, startingDirty, stakeTouched]);

  async function persist(payload: Record<string, string>) {
    if (!onCommand) return;
    await onCommand("updateSettings", payload);
  }

  async function startTable() {
    if (pending) return;
    setPending(true);
    setLocalError(null);
    try {
      if (onCommand && view) {
        await persist(stakeModeToPayload(stakeRef.current, starting));
        await onCommand("finalizeSetup", {
          name,
          startingJetonsPerPlayer: starting,
          game,
          bankFundingMode,
          startingBank: game === "BLACKJACK" ? startingBank : "",
          smallBlind: game === "POKER" ? smallBlind : "",
          bigBlind: game === "POKER" ? bigBlind : "",
          hostName,
          seatOrder: view.members.map((member) => member.userId).join(","),
        });
        return;
      }
      await onCreate({
        name,
        game,
        startingJetonsPerPlayer: starting,
        emails: [],
        hostName: needsHostName ? hostName : undefined,
        bankFundingMode,
        startingBank,
        smallBlind,
        bigBlind,
      });
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not start the table.");
    } finally {
      setPending(false);
    }
  }

  const errorText = localError ?? notice;
  const playerRows = (view?.members ?? []).filter((member) => game === "POKER" || !member.isBankDealer);
  const pendingInvites = (view?.invitations ?? []).filter((invite) => invite.pending);
  const guestJoinUrl = view?.guestJoinUrl ?? null;
  const verifiedJoinUrl = view?.verifiedJoinUrl ?? view?.joinUrl ?? null;

  return (
    <PremiumShell
      title="CREATE TABLE"
      board="CREATE_TABLE"
      dock={
        <CasinoDock
          notice={errorText ? <div className="pm-error" data-create-error="true">{errorText}</div> : null}
          primary={{
            label: pending ? "Starting table" : "START TABLE",
            disabled: pending,
            onClick: () => void startTable(),
          }}
          secondary={{
            label: "BACK",
            disabled: pending,
            onClick: () => {
              if (onCommand && view) {
                void onCommand("abandonDraft");
                return;
              }
              onBack();
            },
          }}
        />
      }
    >
      <div
        className="pm-create"
        data-selected-game={game}
        data-guest-join-url={guestJoinUrl ?? undefined}
        data-verified-join-url={verifiedJoinUrl ?? undefined}
      >
        <div className="pm-create-row pm-two">
          <label className="pm-field">
            Table name
            <input
              className="pm-input"
              value={name}
              onChange={(e) => {
                setNameDirty(true);
                setName(e.target.value);
              }}
              onBlur={() => void persist({ name })}
              aria-label="Table name"
              required
            />
          </label>
          <label className="pm-field">
            Starting jetons
            <input
              className="pm-input"
              value={starting}
              onChange={(e) => {
                setStartingDirty(true);
                setStarting(e.target.value);
              }}
              onBlur={() => void persist({ startingJetonsPerPlayer: starting })}
              aria-label="Starting jetons per player"
              inputMode="numeric"
            />
          </label>
        </div>

        {(needsHostName || !view?.ownerName) && (
          <label className="pm-field">
            Owner / host name
            <input
              className="pm-input"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              aria-label="Owner / host name"
              required={Boolean(needsHostName)}
            />
          </label>
        )}

        <div className="pm-game-row" role="group" aria-label="Game">
          <button
            type="button"
            className={`pm-game-btn${game === "BLACKJACK" ? " is-selected" : ""}`}
            aria-label="BLACKJACK"
            aria-pressed={game === "BLACKJACK"}
            onClick={() => {
              setGame("BLACKJACK");
              if (onCommand && view) void onCommand("updateSettings", { game: "BLACKJACK" });
            }}
          >
            <GameIcon kind="BLACKJACK" />
            <span>BLACKJACK</span>
          </button>
          <button
            type="button"
            className={`pm-game-btn${game === "POKER" ? " is-selected" : ""}`}
            aria-label="TEXAS HOLD’EM"
            aria-pressed={game === "POKER"}
            data-selected-game={game === "POKER" ? "POKER" : undefined}
            onClick={() => {
              setGame("POKER");
              if (onCommand && view) void onCommand("updateSettings", { game: "POKER" });
            }}
          >
            <GameIcon kind="POKER" />
            <span>TEXAS HOLD&apos;EM</span>
          </button>
        </div>

        {game === "BLACKJACK" ? (
          <div className="pm-segment" role="group" aria-label="Bank">
            <button
              type="button"
              className={bankFundingMode === "OPEN" ? "is-active" : ""}
              onClick={() => {
                setBankFundingMode("OPEN");
                void onCommand?.("setBankFunding", { bankFundingMode: "OPEN" });
              }}
            >
              OPEN BANK
            </button>
            <button
              type="button"
              className={bankFundingMode === "LIMITED" ? "is-active" : ""}
              onClick={() => {
                const reserve = limitedReserve(startingBank);
                setBankFundingMode("LIMITED");
                setStartingBank(reserve);
                void onCommand?.("setBankFunding", { bankFundingMode: "LIMITED", startingBank: reserve });
              }}
            >
              LIMITED BANK
            </button>
          </div>
        ) : (
          <div className="pm-two">
            <label className="pm-field">
              Small blind
              <input
                className="pm-input"
                aria-label="Small blind"
                inputMode="numeric"
                value={smallBlind}
                onChange={(e) => setSmallBlind(e.target.value)}
              />
            </label>
            <label className="pm-field">
              Big blind
              <input
                className="pm-input"
                aria-label="Big blind"
                inputMode="numeric"
                value={bigBlind}
                onChange={(e) => setBigBlind(e.target.value)}
              />
            </label>
          </div>
        )}

        {game === "BLACKJACK" && bankFundingMode === "LIMITED" ? (
          <label className="pm-field">
            Limited reserve
            <input
              className="pm-input"
              aria-label="Starting Bank jetons"
              inputMode="numeric"
              value={startingBank}
              onChange={(e) => setStartingBank(e.target.value)}
              onBlur={() => void onCommand?.("setBankFunding", { bankFundingMode: "LIMITED", startingBank })}
            />
          </label>
        ) : null}

        {view?.members.length ? (
          <label className="pm-field">
            Dealer
            <select
              className="pm-input"
              aria-label="Dealer"
              value={dealerId}
              onChange={(e) => {
                setDealerId(e.target.value);
                void onCommand?.("assignBank", { userId: e.target.value });
              }}
            >
              {view.members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                  {member.isOwner ? " (Owner)" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="pm-muted">Dealer · {view?.bankName ?? "Owner (default)"}</p>
        )}

        <PremiumStakeMode
          value={stake}
          startingJetons={starting}
          onChange={(next) => {
            setStakeTouched(true);
            setStake(next);
          }}
          onPersist={(payload) => void persist(payload)}
        />

        <div className="pm-create-players">
          <div className="pm-label">PLAYERS</div>
          {playerRows.length ? (
            <div className="pm-chip-rows">
              {playerRows.map((member) => (
                <div className="pm-chip-row" key={member.userId} data-player-row="true">
                  <strong>{member.name}</strong>
                  <small>
                    {member.isOwner ? "Owner" : "Player"}
                    {member.isBankDealer ? " · Dealer" : ""} · {member.available?.label ?? "0"}
                  </small>
                </div>
              ))}
            </div>
          ) : pendingInvites.length === 0 ? (
            <p className="pm-muted">No players yet.</p>
          ) : null}
          {pendingInvites.map((invite) => (
            <div className="pm-chip-row" key={invite.id} data-seat-status="Invited">
              <strong>{invite.email ?? "Player"}</strong>
              <small>Pending</small>
            </div>
          ))}
          <button
            type="button"
            className="pm-invite-btn"
            aria-label="INVITE PLAYER"
            onClick={() => setInviteOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
              <circle cx="9" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 18c.8-3 2.8-4.5 5.5-4.5s4.7 1.5 5.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M17 8v6M14 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>INVITE PLAYER</span>
          </button>
        </div>
      </div>

      <PremiumInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={guestJoinUrl}
        verifiedJoinUrl={verifiedJoinUrl}
        emailConfigured={view?.emailConfigured !== false}
        startingJetons={starting}
        members={view?.members}
        invitations={view?.invitations}
        onCommand={onCommand ?? (async () => undefined)}
        notice={notice}
      />
    </PremiumShell>
  );
}
