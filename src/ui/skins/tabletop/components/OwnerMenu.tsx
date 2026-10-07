"use client";

import { useEffect, useState } from "react";
import type { BankrollView, CloseTablePreview, MemberView, PokerSeatView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { Sheet } from "./Sheet";
import { GameChangeSheet } from "./GameChangeSheet";
import type { GameSessionView } from "@/application/queries/views";

type View = "menu" | "rename" | "dealer" | "player" | "jetons" | "game" | "poker" | "close" | "dealerWon" | "funding" | "seats" | "session";

export type OwnerMenuItem = { label: string; disabled?: boolean; onClick: () => void; attrs?: Record<string, string> };

export type OwnerMenuProps = {
  open: boolean;
  onClose: () => void;
  tableName: string;
  members: MemberView[];
  onCommand: CommandHandler;
  /** Game currently in play, used to offer the other game. */
  game?: "BLACKJACK" | "POKER";
  /** Hand-specific entries rendered first (DEAL IN 7 SECONDS, NEXT HAND IN 7 SECONDS…). */
  items?: OwnerMenuItem[];
  addPlayer?: "invite" | "full" | "name" | false;
  onInvite?: () => void;
  giveJetons?: boolean;
  rename?: boolean;
  changeDealer?: boolean;
  switchGame?: boolean;
  dealerWon?: boolean;
  bankroll?: BankrollView | null;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO" | null;
  seats?: PokerSeatView[] | null;
  seatsHint?: string;
  /** Owner-only SAVE TABLE / CLOSE TABLE entries. */
  lifecycle?: boolean;
  canSave?: boolean;
  canClose?: boolean;
  closePreview?: CloseTablePreview | null;
  closeCopy?: string;
  gameSession?: GameSessionView | null;
  startView?: View;
};

function moveSeat(ids: string[], index: number, delta: -1 | 1) {
  const next = [...ids];
  const target = index + delta;
  if (target < 0 || target >= next.length) return next.join(",");
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next.join(",");
}

/** Owner / dealer table menu rendered as stacked bottom sheets. */
export function OwnerMenu({
  open,
  onClose,
  tableName,
  members,
  onCommand,
  game = "BLACKJACK",
  items = [],
  addPlayer = "full",
  onInvite,
  giveJetons = true,
  rename = true,
  changeDealer = false,
  switchGame = false,
  dealerWon = false,
  bankroll = null,
  cardAssist = null,
  seats = null,
  seatsHint,
  lifecycle = true,
  canSave = true,
  canClose = true,
  closePreview = null,
  closeCopy,
  gameSession = null,
  startView = "menu",
}: OwnerMenuProps) {
  const [view, setView] = useState<View>(startView);
  const [name, setName] = useState(tableName);
  const [playerName, setPlayerName] = useState("");
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const [dealerId, setDealerId] = useState(members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "");
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [startingBank, setStartingBank] = useState(bankroll?.available.label || "500");

  useEffect(() => {
    if (open) setView(startView);
  }, [open, startView]);

  function done() {
    setView("menu");
    onClose();
  }
  function back() {
    setView("menu");
  }

  const current: View = open ? view : "menu";

  return (
    <Sheet open={open} onClose={done} className="tt-owner-menu">
      {current === "menu" ? (
        <>
          <h3>Table</h3>
          <div className="tt-menu-list" data-owner-menu="true">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                className="tt-btn"
                disabled={item.disabled}
                {...item.attrs}
                onClick={() => {
                  item.onClick();
                  done();
                }}
              >
                {item.label}
              </button>
            ))}
            {seats && seats.length > 1 ? (
              <button type="button" className="tt-btn" onClick={() => setView("seats")}>
                SEAT ORDER
              </button>
            ) : null}
            {dealerWon ? (
              <button type="button" className="tt-btn" onClick={() => setView("dealerWon")}>
                DEALER WON
              </button>
            ) : null}
            {addPlayer === "invite" ? (
              <button
                type="button"
                className="tt-btn"
                onClick={() => {
                  done();
                  onInvite?.();
                }}
              >
                ADD PLAYER
              </button>
            ) : addPlayer ? (
              <button type="button" className="tt-btn" onClick={() => setView("player")}>
                {addPlayer === "name" ? "ADD LOCAL PLAYER" : "ADD PLAYER"}
              </button>
            ) : null}
            {giveJetons ? (
              <button type="button" className="tt-btn" data-give-jetons="true" onClick={() => setView("jetons")}>
                {game === "POKER" ? "BUY-IN" : "GIVE JETONS"}
              </button>
            ) : null}
            {rename ? (
              <button type="button" className="tt-btn" onClick={() => setView("rename")}>
                RENAME TABLE
              </button>
            ) : null}
            {changeDealer ? (
              <button type="button" className="tt-btn" data-owner-change-dealer="true" onClick={() => setView("dealer")}>
                Change Dealer
              </button>
            ) : null}
            {switchGame ? (
              <button type="button" className="tt-btn" data-owner-change-game="true" onClick={() => setView("session")}>
                Change Game
              </button>
            ) : null}
          </div>
          {bankroll ? (
            <>
              <div className="tt-label">BANK</div>
              <div className="tt-segment">
                <button
                  type="button"
                  className={bankroll.mode === "OPEN" ? "active" : ""}
                  disabled={!bankroll.canToggle}
                  onClick={() => onCommand("setBankFunding", { bankFundingMode: "OPEN" })}
                >
                  OPEN BANK
                </button>
                <button
                  type="button"
                  className={bankroll.mode === "LIMITED" ? "active" : ""}
                  disabled={!bankroll.canToggle}
                  onClick={() => setView("funding")}
                >
                  LIMITED BANK
                </button>
              </div>
              {bankroll.lockedReason ? <p className="tt-muted">{bankroll.lockedReason}</p> : null}
            </>
          ) : null}
          {cardAssist ? (
            <>
              <div className="tt-label">OPTIONAL TOOLS · CARD ASSIST</div>
              <div className="tt-segment">
                {(["OFF", "CONFIRM", "AUTO"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={cardAssist === mode ? "active" : ""}
                    onClick={() => onCommand("setCardAssist", { cardAssist: mode })}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {lifecycle ? (
            <>
              <button
                className="tt-btn gold"
                type="button"
                disabled={!canSave}
                onClick={() => {
                  void onCommand("saveTable");
                  done();
                }}
              >
                SAVE TABLE
              </button>
              <button className="tt-btn gold" type="button" disabled={!canClose} onClick={() => setView("close")}>
                CLOSE TABLE & SAVE BALANCES
              </button>
            </>
          ) : null}
          <button className="tt-link" type="button" onClick={done}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "seats" && seats ? (
        <>
          <h3>Seat order</h3>
          {seatsHint ? <p className="tt-muted">{seatsHint}</p> : null}
          <ol className="tt-seat-order" aria-label="Seat order">
            {seats.map((seat, index) => {
              const ids = seats.map((entry) => entry.userId);
              return (
                <li key={seat.userId}>
                  <span>
                    {index + 1}. {seat.name}
                  </span>
                  <span className="tt-seat-order-controls">
                    <button
                      type="button"
                      aria-label={`Move ${seat.name} up`}
                      disabled={index === 0}
                      onClick={() => void onCommand("configurePoker", { seatOrder: moveSeat(ids, index, -1) })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${seat.name} down`}
                      disabled={index === seats.length - 1}
                      onClick={() => void onCommand("configurePoker", { seatOrder: moveSeat(ids, index, 1) })}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
          <button className="tt-link" type="button" onClick={back}>
            Back
          </button>
        </>
      ) : null}

      {current === "rename" ? (
        <>
          <h3>Rename table</h3>
          <label className="tt-field">
            Table name
            <input className="tt-input" aria-label="Table name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <button
            className="tt-btn gold"
            type="button"
            onClick={async () => {
              const ok = await onCommand("updateSettings", { name });
              if (ok !== false) done();
            }}
          >
            Save name
          </button>
          <button className="tt-link" type="button" onClick={back}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "dealer" ? (
        <>
          <h3>Assign Dealer</h3>
          <label className="tt-field">
            Dealer
            <select className="tt-input" aria-label="Dealer" value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="tt-btn gold"
            type="button"
            onClick={() => {
              void onCommand("assignBank", { userId: dealerId });
              done();
            }}
          >
            Confirm dealer
          </button>
          <button className="tt-link" type="button" onClick={done}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "session" || current === "game" || current === "poker" ? (
        <GameChangeSheet
          game={game}
          members={members}
          session={gameSession}
          onCommand={(command, payload) => {
            void onCommand(command, payload);
            done();
          }}
          onCancel={done}
        />
      ) : null}

      {current === "funding" ? (
        <>
          <h3>Limited Bank</h3>
          <input
            className="tt-input"
            placeholder="Starting Bank jetons"
            aria-label="Starting Bank jetons"
            value={startingBank}
            onChange={(event) => setStartingBank(event.target.value)}
          />
          <button
            className="tt-btn gold"
            type="button"
            onClick={() => {
              void onCommand("setBankFunding", { bankFundingMode: "LIMITED", startingBank });
              done();
            }}
          >
            Confirm Limited Bank
          </button>
          <button className="tt-link" type="button" onClick={back}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "close" ? (
        <>
          <h3>Close {tableName}</h3>
          <p>{closePreview?.confirmation ?? closeCopy ?? "Save each Player’s remaining jetons to their personal ledger and close this table?"}</p>
          {(closePreview?.players ?? []).map((player) => (
            <div className="tt-chip-row" key={player.userId}>
              <strong>{player.name}</strong>
              <small>
                Personal ledger · {player.available.label} · Locked {player.locked.label}
              </small>
            </div>
          ))}
          <button
            className="tt-btn gold"
            type="button"
            disabled={!canClose}
            onClick={() => {
              void onCommand("closeTable");
              done();
            }}
          >
            Confirm close
          </button>
          <button className="tt-link" type="button" onClick={back}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "dealerWon" ? (
        <>
          <h3>Dealer won</h3>
          <p>Dealer wins against all unresolved boxes?</p>
          <button
            className="tt-btn gold"
            type="button"
            onClick={() => {
              void onCommand("settleDealerWon");
              done();
            }}
          >
            Confirm
          </button>
          <button className="tt-link" type="button" onClick={back}>
            Cancel
          </button>
        </>
      ) : null}

      {current === "jetons" || current === "player" ? (
        <>
          <h3>{current === "jetons" ? (game === "POKER" ? "Buy-in" : "Give jetons") : "Add player"}</h3>
          {current === "jetons" ? (
            <>
              <select className="tt-input" value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label="Player">
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              <input className="tt-input" placeholder="Jeton amount" aria-label="Jeton amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </>
          ) : (
            <>
              <input className="tt-input" placeholder="Player name" aria-label="Player name" value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
              {addPlayer === "name" ? null : (
                <>
                  <input className="tt-input" placeholder="Starting jetons" aria-label="Starting jetons" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  <input className="tt-input" placeholder="Email optional" aria-label="Player email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </>
              )}
            </>
          )}
          <div className="tt-two">
            <button type="button" className="tt-btn" onClick={back}>
              Cancel
            </button>
            <button
              className="tt-btn gold"
              type="button"
              onClick={async () => {
                let ok: void | boolean = true;
                if (current === "jetons") ok = await onCommand("giveJetons", { userId: memberId, amount });
                else if (addPlayer === "name") ok = await onCommand("addPlayer", { name: playerName });
                else if (email.trim()) ok = await onCommand("addPlayer", { email, name: playerName });
                else ok = await onCommand("addPlayer", { name: playerName, startingJetons: amount });
                if (ok !== false) {
                  setPlayerName("");
                  setEmail("");
                  setAmount("");
                  done();
                }
              }}
            >
              Confirm
            </button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
