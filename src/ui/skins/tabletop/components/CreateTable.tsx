"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import { GAME_CATALOG } from "@/domain/games";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { InviteInline, type InviteTab } from "./InviteMask";

type CreateTableFields = {
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
};

const SUITS: Record<string, string> = { BLACKJACK: "♠", POKER: "♥", ZILCH: "⚀" };

function limitedReserve(value?: string | null) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : BLACKJACK_TABLE_DEFAULTS.startingBank;
}

/** Compact Create Table on the felt. Persists via `updateSettings`, starts via `finalizeSetup` / `onCreate`. */
export function CreateTable({
  defaultTableName,
  defaultStartingJetons,
  defaultHostName,
  needsHostName,
  notice,
  onBack,
  onCreate,
  view,
  onCommand,
}: {
  defaultTableName: string;
  defaultStartingJetons?: string;
  defaultHostName?: string;
  needsHostName?: boolean;
  initialEmails?: string[];
  joinUrl?: string | null;
  notice?: string | null;
  onBack: () => void;
  onCreate: (fields: CreateTableFields) => Promise<void>;
  embedded?: boolean;
  view?: SetupTableView | null;
  onCommand?: CommandHandler;
}) {
  const [name, setName] = useState(view?.tableName ?? defaultTableName);
  const [hostName, setHostName] = useState(defaultHostName ?? view?.ownerName ?? "");
  const [startingJetonsPerPlayer, setStartingJetonsPerPlayer] = useState(
    view?.startingJetonsPerPlayer.label ?? defaultStartingJetons ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const [game, setGame] = useState<"BLACKJACK" | "POKER">(view?.gameId === "POKER" ? "POKER" : "BLACKJACK");
  const [bankFundingMode, setBankFundingMode] = useState<"OPEN" | "LIMITED">(view?.bankFundingMode ?? "OPEN");
  const [startingBank, setStartingBank] = useState(limitedReserve(view?.startingBank?.label));
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [dealerId, setDealerId] = useState(view?.members.find((member) => member.isBankDealer)?.userId ?? "");
  const [pending, setPending] = useState(false);
  const [nameDirty, setNameDirty] = useState(false);
  const [startingDirty, setStartingDirty] = useState(false);
  const [inviteMethod, setInviteMethod] = useState<InviteTab | null>(null);
  const [stakeType, setStakeType] = useState<"MONEY" | "CUSTOM">("MONEY");
  const [currency, setCurrency] = useState("GBP");
  const [moneyPerJeton, setMoneyPerJeton] = useState("1");
  const [customLabel, setCustomLabel] = useState("Dinner");
  const [jetonsPerUnit, setJetonsPerUnit] = useState("50");

  useEffect(() => {
    if (!view) return;
    if (!nameDirty) setName(view.tableName);
    if (!startingDirty) setStartingJetonsPerPlayer(view.startingJetonsPerPlayer.label);
    setBankFundingMode(view.bankFundingMode ?? "OPEN");
    if (view.bankFundingMode === "LIMITED" && view.startingBank?.label) setStartingBank(limitedReserve(view.startingBank.label));
    setDealerId(view.members.find((member) => member.isBankDealer)?.userId ?? "");
  }, [view, nameDirty, startingDirty]);

  async function persist(payload: Record<string, string>) {
    if (!onCommand) return;
    await onCommand("updateSettings", payload);
  }

  const playerRows = (view?.members ?? []).filter((member) => game === "POKER" || !member.isBankDealer);
  const pendingInvites = (view?.invitations ?? []).filter((invite) => invite.pending);
  const guestJoinUrl = view?.guestJoinUrl ?? null;
  const verifiedJoinUrl = view?.verifiedJoinUrl ?? view?.joinUrl ?? null;
  const playable = GAME_CATALOG.filter((entry) => entry.available);
  const later = GAME_CATALOG.filter((entry) => !entry.available);

  const rail = (
    <div className="tt-dock">
      <button
        className="tt-btn gold"
        type="button"
        data-selected-game={game}
        disabled={pending}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          try {
            if (onCommand && view) {
              await onCommand("finalizeSetup", {
                name,
                startingJetonsPerPlayer,
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
              startingJetonsPerPlayer,
              emails: [],
              hostName: needsHostName ? hostName : undefined,
              bankFundingMode,
              startingBank,
              smallBlind,
              bigBlind,
            });
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Starting table" : "START TABLE"}
      </button>
      <button
        className="tt-link"
        type="button"
        onClick={() => {
          if (onCommand && view) {
            void onCommand("abandonDraft");
            return;
          }
          onBack();
        }}
      >
        Cancel
      </button>
    </div>
  );

  return (
    <Shell
      rail={rail}
      feltClassName="tt-create is-form"
      feltProps={{
        "data-table-board": "CREATE_TABLE",
        "data-guest-join-url": guestJoinUrl ?? undefined,
        "data-verified-join-url": verifiedJoinUrl ?? undefined,
        "data-join-url": verifiedJoinUrl ?? undefined,
      }}
    >
      <div className="tt-create-heading">
        <h1>CREATE TABLE</h1>
      </div>
      <div className="tt-create-body">
        {notice ? <div className="tt-error">{notice}</div> : null}
        <section className="tt-block is-compact">
          <div className="tt-two">
            <label className="tt-field">
              Table name
              <input
                className="tt-input"
                name="name"
                aria-label="Table name"
                value={name}
                required
                onChange={(event) => {
                  setNameDirty(true);
                  setName(event.target.value);
                }}
                onBlur={() => void persist({ name })}
              />
            </label>
            <label className="tt-field">
              Starting jetons
              <input
                className="tt-input"
                name="startingJetonsPerPlayer"
                aria-label="Starting jetons per player"
                inputMode="numeric"
                pattern="[0-9]*"
                value={startingJetonsPerPlayer}
                onChange={(event) => {
                  setStartingDirty(true);
                  setStartingJetonsPerPlayer(event.target.value);
                }}
                onBlur={() => void persist({ startingJetonsPerPlayer })}
              />
            </label>
          </div>
          {needsHostName || !view?.ownerName ? (
            <label className="tt-field">
              Owner / host name
              <input
                className="tt-input"
                name="hostName"
                aria-label="Owner / host name"
                value={hostName}
                required={Boolean(needsHostName)}
                onChange={(event) => setHostName(event.target.value)}
              />
            </label>
          ) : (
            <div className="tt-muted tt-create-meta">Owner · {view.ownerName}</div>
          )}
          <div className="tt-segment" role="group" aria-label="Game">
            {playable.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={game === entry.id ? "active" : ""}
                aria-pressed={game === entry.id}
                onClick={() => {
                  if (entry.id !== "BLACKJACK" && entry.id !== "POKER") return;
                  setGame(entry.id);
                  if (onCommand && view) void onCommand("switchGame", { game: entry.id });
                }}
              >
                <span aria-hidden="true">{SUITS[entry.id]}</span> {entry.label}
              </button>
            ))}
          </div>
          {later.map((entry) => (
            <p className="tt-muted tt-create-meta" key={entry.id}>
              {entry.label} · Coming later
            </p>
          ))}
          {game === "BLACKJACK" ? (
            <div className="tt-segment" role="group" aria-label="Bank">
              <button
                type="button"
                className={bankFundingMode === "OPEN" ? "active" : ""}
                onClick={() => {
                  setBankFundingMode("OPEN");
                  void onCommand?.("setBankFunding", { bankFundingMode: "OPEN" });
                }}
              >
                OPEN BANK
              </button>
              <button
                type="button"
                className={bankFundingMode === "LIMITED" ? "active" : ""}
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
            <div className="tt-two">
              <label className="tt-field">
                Small blind
                <input className="tt-input" aria-label="Small blind" inputMode="numeric" value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} />
              </label>
              <label className="tt-field">
                Big blind
                <input className="tt-input" aria-label="Big blind" inputMode="numeric" value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} />
              </label>
            </div>
          )}
          {game === "BLACKJACK" && bankFundingMode === "LIMITED" ? (
            <label className="tt-field">
              Limited reserve
              <input
                className="tt-input"
                name="startingBank"
                aria-label="Starting Bank jetons"
                inputMode="numeric"
                pattern="[0-9]*"
                value={startingBank}
                onChange={(event) => setStartingBank(event.target.value)}
                onBlur={() => void onCommand?.("setBankFunding", { bankFundingMode: "LIMITED", startingBank })}
              />
            </label>
          ) : null}
          {view?.members.length ? (
            <label className="tt-field">
              Dealer
              <select
                className="tt-input"
                aria-label="Dealer"
                value={dealerId}
                onChange={(event) => {
                  setDealerId(event.target.value);
                  void onCommand?.("assignBank", { userId: event.target.value });
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
            <div className="tt-muted tt-create-meta">Dealer · {view?.bankName ?? "Owner (default)"}</div>
          )}
        </section>
        <section className="tt-block is-compact" data-playing-for="true">
          <div className="tt-label">PLAYING FOR</div>
          <div className="tt-segment">
            <button
              type="button"
              className={stakeType === "MONEY" ? "active" : ""}
              onClick={() => {
                setStakeType("MONEY");
                void onCommand?.("updateSettings", { stakeType: "MONEY", currencyCode: currency, moneyPerJeton });
              }}
            >
              MONEY
            </button>
            <button
              type="button"
              className={stakeType === "CUSTOM" ? "active" : ""}
              onClick={() => {
                setStakeType("CUSTOM");
                void onCommand?.("updateSettings", { stakeType: "CUSTOM", customUnitLabel: customLabel, jetonsPerCustomUnit: jetonsPerUnit });
              }}
            >
              SOMETHING ELSE
            </button>
          </div>
          {stakeType === "MONEY" ? (
            <>
              <label className="tt-field">
                Currency
                <select className="tt-input" aria-label="Currency" value={currency} onChange={(event) => {
                  setCurrency(event.target.value);
                  void onCommand?.("updateSettings", { stakeType: "MONEY", currencyCode: event.target.value, moneyPerJeton });
                }}>
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label className="tt-field">
                Value of one jeton
                <input className="tt-input" aria-label="Value of one jeton" value={moneyPerJeton} onChange={(event) => setMoneyPerJeton(event.target.value)} onBlur={() => void onCommand?.("updateSettings", { stakeType: "MONEY", currencyCode: currency, moneyPerJeton })} />
              </label>
              <p className="tt-muted">1 jeton = {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{moneyPerJeton || "1"}</p>
            </>
          ) : (
            <>
              <label className="tt-field">
                Unit
                <input className="tt-input" aria-label="Custom unit label" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} onBlur={() => void onCommand?.("updateSettings", { stakeType: "CUSTOM", customUnitLabel: customLabel, jetonsPerCustomUnit: jetonsPerUnit })} />
              </label>
              <label className="tt-field">
                Jetons per unit
                <input className="tt-input" aria-label="Jetons per custom unit" value={jetonsPerUnit} onChange={(event) => setJetonsPerUnit(event.target.value)} onBlur={() => void onCommand?.("updateSettings", { stakeType: "CUSTOM", customUnitLabel: customLabel, jetonsPerCustomUnit: jetonsPerUnit })} />
              </label>
              <p className="tt-muted">{jetonsPerUnit || "50"} jetons = 1 {customLabel || "Dinner"}</p>
            </>
          )}
        </section>
        <section className="tt-block is-compact">
          <div className="tt-label">PLAYERS</div>
          {playerRows.length ? (
            <div className="tt-chip-rows">
              {playerRows.map((member) => (
                <div className="tt-chip-row" key={member.userId} data-player-row="true">
                  <strong>{member.name}</strong>
                  <small>
                    {member.isOwner ? "Owner" : "Player"}
                    {member.isBankDealer ? " · Dealer" : ""} · {member.available?.label ?? "0"}
                  </small>
                </div>
              ))}
            </div>
          ) : pendingInvites.length === 0 ? (
            <p className="tt-muted tt-create-meta">No players yet.</p>
          ) : null}
          <InviteInline
            guestJoinUrl={guestJoinUrl}
            verifiedJoinUrl={verifiedJoinUrl}
            emailConfigured={view?.emailConfigured !== false}
            startingJetons={startingJetonsPerPlayer}
            members={view?.members}
            invitations={view?.invitations}
            onCommand={onCommand ?? (async () => undefined)}
            selectedMethod={inviteMethod}
            onSelectMethod={setInviteMethod}
          />
        </section>
      </div>
    </Shell>
  );
}
