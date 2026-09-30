"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import type { CommandHandler } from "@/ui/skins/types";
import { PhoneShell } from "./PhoneShell";
import { ClassicGameCards } from "./ClassicGameCards";
import { SheetOverlay } from "./SheetOverlay";
import { ClassicInvitePanel } from "./ClassicInvitePanel";

function limitedReserve(value?: string | null) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : BLACKJACK_TABLE_DEFAULTS.startingBank;
}

export type CreateTableFields = {
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

export function ClassicCreateTable({
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
  members?: { userId: string; name: string }[];
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
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!view) return;
    setName(view.tableName);
    setStartingJetonsPerPlayer(view.startingJetonsPerPlayer.label);
    setBankFundingMode(view.bankFundingMode ?? "OPEN");
    if (view.bankFundingMode === "LIMITED" && view.startingBank?.label) {
      setStartingBank(limitedReserve(view.startingBank.label));
    }
    setDealerId(view.members.find((member) => member.isBankDealer)?.userId ?? "");
  }, [view]);

  async function persist(payload: Record<string, string>) {
    if (!onCommand) return;
    await onCommand("updateSettings", payload);
  }

  const playerRows = (view?.members ?? []).filter((member) => game === "POKER" || !member.isBankDealer);
  const invited = (view?.invitations ?? []).filter((invite) => invite.pending);

  return (
    <PhoneShell>
      <div className="phase-head home-head-compact">
        <strong>CREATE TABLE</strong>
        <span>Configure the table, then start.</span>
      </div>
      <main className="felt home-stack create-setup">
        {notice ? <div className="error">{notice}</div> : null}
        <label>
          Table name
          <input
            name="name"
            aria-label="Table name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void persist({ name })}
            required
          />
        </label>
        {needsHostName || !view?.ownerName ? (
          <label>
            Owner / host name
            <input
              name="hostName"
              aria-label="Owner / host name"
              value={hostName}
              onChange={(event) => setHostName(event.target.value)}
              required={Boolean(needsHostName)}
            />
          </label>
        ) : (
          <div className="muted">Owner · {view.ownerName}</div>
        )}
        <label>
          Starting jetons per Player
          <input
            name="startingJetonsPerPlayer"
            aria-label="Starting jetons per player"
            inputMode="numeric"
            pattern="[0-9]*"
            value={startingJetonsPerPlayer}
            onChange={(event) => setStartingJetonsPerPlayer(event.target.value)}
            onBlur={() => void persist({ startingJetonsPerPlayer })}
          />
        </label>
        <div>
          <div className="field-label">Game</div>
          <ClassicGameCards
            selectedId={game}
            onSelect={(id) => {
              if (id === "BLACKJACK" || id === "POKER") setGame(id);
            }}
            compact
          />
        </div>
        {game === "BLACKJACK" ? (
          <div>
            <div className="field-label">Bank</div>
            <div className="setting-row funding-toggle">
              <button
                type="button"
                className={bankFundingMode === "OPEN" ? "active" : ""}
                onClick={() => {
                  setBankFundingMode("OPEN");
                  onCommand?.("setBankFunding", { bankFundingMode: "OPEN" });
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
                  onCommand?.("setBankFunding", {
                    bankFundingMode: "LIMITED",
                    startingBank: reserve,
                  });
                }}
              >
                LIMITED BANK
              </button>
            </div>
            {bankFundingMode === "LIMITED" ? (
              <label>
                Starting Bank jetons
                <input
                  name="startingBank"
                  aria-label="Starting Bank jetons"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={startingBank}
                  onChange={(event) => setStartingBank(event.target.value)}
                  onBlur={() =>
                    onCommand?.("setBankFunding", { bankFundingMode: "LIMITED", startingBank })
                  }
                />
              </label>
            ) : null}
          </div>
        ) : (
          <div className="blind-row">
            <label>
              Small blind
              <input
                aria-label="Small blind"
                inputMode="numeric"
                value={smallBlind}
                onChange={(event) => setSmallBlind(event.target.value)}
              />
            </label>
            <label>
              Big blind
              <input
                aria-label="Big blind"
                inputMode="numeric"
                value={bigBlind}
                onChange={(event) => setBigBlind(event.target.value)}
              />
            </label>
          </div>
        )}
        {view?.members.length ? (
          <label>
            Dealer
            <select
              aria-label="Dealer"
              value={dealerId}
              onChange={(event) => {
                setDealerId(event.target.value);
                onCommand?.("assignBank", { userId: event.target.value });
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
          <div className="muted">Dealer · {view?.bankName ?? "Owner (default)"}</div>
        )}
        <div>
          <div className="field-label">Players</div>
          <div className="phase-zero-rows">
            {playerRows.map((member) => (
              <div className="phase-zero-row member-row" key={member.userId}>
                <div>
                  <strong>{member.name}</strong>
                  <div className="muted">
                    {member.isOwner ? "Owner" : "Player"}
                    {member.isBankDealer ? " · Dealer" : ""}
                  </div>
                </div>
                <span>{member.available?.label ?? "0"}</span>
              </div>
            ))}
            {invited.map((invite) => (
              <div className="phase-zero-row member-row" key={invite.id}>
                <div>
                  <strong>{invite.email ?? "Player"}</strong>
                  <div className="muted">Invited</div>
                </div>
              </div>
            ))}
            {playerRows.length === 0 && invited.length === 0 ? (
              <p className="muted phase-zero-empty">Invite Players before you start, or add a local Player.</p>
            ) : null}
          </div>
        </div>
        <button className="panel-button" type="button" onClick={() => setInviteOpen(true)}>
          Invite Player
        </button>
      </main>
      <SheetOverlay open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <ClassicInvitePanel
          joinUrl={view?.joinUrl ?? null}
          emailConfigured={view?.emailConfigured !== false}
          startingJetons={startingJetonsPerPlayer}
          onCommand={onCommand ?? (async () => undefined)}
          notice={notice}
        />
        <button className="text-link" type="button" onClick={() => setInviteOpen(false)}>
          Close
        </button>
      </SheetOverlay>
      <footer className="dock">
        <button
          className="gold-button"
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
          className="text-link"
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
      </footer>
    </PhoneShell>
  );
}
