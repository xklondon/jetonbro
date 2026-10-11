"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { CasinoDock } from "./primitives/CasinoDock";

function limitedReserve(value?: string | null) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : BLACKJACK_TABLE_DEFAULTS.startingBank;
}

/** Stake payload from the draft snapshot — FUN_ONLY unless the draft already chose another mode. */
function stakePayloadFromView(view: SetupTableView | null | undefined): Record<string, string> {
  const stakeType = view?.gameSession?.stakeType;
  if (stakeType === "MONEY" || stakeType === "CUSTOM") {
    return { stakeType };
  }
  return { stakeType: "FUN_ONLY" };
}

/**
 * Premium Create Table — same command contract as Tabletop CreateTable:
 * draft `updateSettings` then `finalizeSetup`. TableSession's `onCreate` is a no-op.
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
  const [bankFundingMode] = useState<"OPEN" | "LIMITED">(view?.bankFundingMode ?? BLACKJACK_TABLE_DEFAULTS.bankFundingMode);
  const [startingBank] = useState(limitedReserve(view?.startingBank?.label));
  const [smallBlind] = useState("5");
  const [bigBlind] = useState("10");
  const [nameDirty, setNameDirty] = useState(false);
  const [startingDirty, setStartingDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!view) return;
    if (!nameDirty) setName(view.tableName);
    if (!startingDirty) setStarting(view.startingJetonsPerPlayer.label);
    if (view.gameId === "POKER" || view.gameId === "BLACKJACK") setGame(view.gameId);
  }, [view, nameDirty, startingDirty]);

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
        await persist({
          name,
          startingJetonsPerPlayer: starting,
          game,
          ...stakePayloadFromView(view),
        });
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
      <div className="pm-panel" data-selected-game={game}>
        <h1>CREATE TABLE</h1>
        <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          <span>Table name</span>
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
        <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          <span>Starting jetons per player</span>
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
        {(needsHostName || !view?.ownerName) && (
          <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
            <span>Owner / host name</span>
            <input
              className="pm-input"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              aria-label="Owner / host name"
              required={Boolean(needsHostName)}
            />
          </label>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className={`pm-btn ${game === "BLACKJACK" ? "is-primary" : "is-ghost"}`}
            aria-pressed={game === "BLACKJACK"}
            onClick={() => {
              setGame("BLACKJACK");
              if (onCommand && view) void onCommand("updateSettings", { game: "BLACKJACK" });
            }}
          >
            Blackjack
          </button>
          <button
            type="button"
            className={`pm-btn ${game === "POKER" ? "is-primary" : "is-ghost"}`}
            aria-pressed={game === "POKER"}
            data-selected-game={game === "POKER" ? "POKER" : undefined}
            onClick={() => {
              setGame("POKER");
              if (onCommand && view) void onCommand("updateSettings", { game: "POKER" });
            }}
          >
            Texas Hold&apos;em
          </button>
        </div>
      </div>
    </PremiumShell>
  );
}
