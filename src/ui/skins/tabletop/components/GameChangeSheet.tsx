"use client";

import { useMemo, useState } from "react";
import type { GameSessionView, MemberView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";

type Step = "save" | "game" | "setup";

export function GameChangeSheet({
  game,
  members,
  session,
  onCommand,
  onCancel,
}: {
  game: "BLACKJACK" | "POKER";
  members: MemberView[];
  session?: GameSessionView | null;
  onCommand: CommandHandler;
  onCancel: () => void;
}) {
  const needsSave = Boolean(session && session.status !== "SETUP");
  const [step, setStep] = useState<Step>(needsSave ? "save" : "game");
  const [savePersonal, setSavePersonal] = useState(true);
  const [nextGame, setNextGame] = useState<"BLACKJACK" | "POKER">(game === "POKER" ? "BLACKJACK" : "POKER");
  const [starting, setStarting] = useState(session?.startingJetons.label ?? "100");
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(members.map((member) => [member.userId, true])),
  );
  const [stakeType, setStakeType] = useState<"MONEY" | "CUSTOM">(session?.stakeType ?? "MONEY");
  const [currency, setCurrency] = useState("GBP");
  const [moneyPerJeton, setMoneyPerJeton] = useState("1");
  const [customLabel, setCustomLabel] = useState("Dinner");
  const [jetonsPerUnit, setJetonsPerUnit] = useState("50");
  const [dealerId, setDealerId] = useState(members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "");

  const chosen = useMemo(() => members.filter((member) => selected[member.userId]), [members, selected]);

  function start() {
    void onCommand("startNewGame", {
      game: nextGame,
      savePersonalLedger: savePersonal ? "true" : "false",
      startingJetonsPerPlayer: starting,
      participantUserIds: chosen.map((member) => member.userId).join(","),
      stakeType,
      currencyCode: currency,
      moneyPerJeton,
      customUnitLabel: customLabel,
      jetonsPerCustomUnit: jetonsPerUnit,
      dealerUserId: chosen.some((member) => member.userId === dealerId) ? dealerId : chosen[0]?.userId ?? "",
    });
  }

  if (step === "save") {
    return (
      <>
        <h3>Save previous game</h3>
        <p className="tt-muted" data-session-boundary="true">
          Current game: {session?.gameType === "POKER" ? "Poker" : "Blackjack"}
          <br />
          Started: {session?.startedAt ? new Date(session.startedAt).toLocaleString() : "—"}
          <br />
          Players: {session?.players.map((player) => player.name).join(", ") || "—"}
          <br />
          Current results: {session?.players.map((player) => `${player.name} ${player.available.label}`).join(" · ") || "—"}
        </p>
        <button
          className="tt-btn gold"
          type="button"
          onClick={() => {
            setSavePersonal(true);
            setStep("game");
          }}
        >
          SAVE RESULTS & START NEW GAME
        </button>
        <button
          className="tt-btn"
          type="button"
          onClick={() => {
            setSavePersonal(false);
            setStep("game");
          }}
        >
          START NEW GAME WITHOUT PERSONAL LEDGER
        </button>
        <button className="tt-link" type="button" onClick={onCancel}>
          CANCEL
        </button>
      </>
    );
  }

  if (step === "game") {
    return (
      <>
        <h3>Start new game</h3>
        <button className="tt-btn gold" type="button" onClick={() => { setNextGame("BLACKJACK"); setStep("setup"); }}>
          Blackjack
        </button>
        <button className="tt-btn gold" type="button" data-new-game="POKER" onClick={() => { setNextGame("POKER"); setStep("setup"); }}>
          Texas Hold’em
        </button>
        <button type="button" className="tt-btn" disabled>
          Zilch — Coming later
        </button>
        <button className="tt-link" type="button" onClick={onCancel}>
          Cancel
        </button>
      </>
    );
  }

  return (
    <>
      <h3>New {nextGame === "POKER" ? "Poker" : "Blackjack"} game</h3>
      <div className="tt-session-people" data-new-session-setup="true">
        {members.map((member) => (
          <label key={member.userId} className="tt-check-row">
            <input
              type="checkbox"
              checked={Boolean(selected[member.userId])}
              onChange={(event) => setSelected((current) => ({ ...current, [member.userId]: event.target.checked }))}
            />
            <span>
              {member.name}
              {member.isOwner ? " — Owner" : ""}
              {member.isBankDealer ? " / Dealer" : " — Player"}
            </span>
          </label>
        ))}
      </div>
      <label className="tt-field">
        Starting jetons
        <input className="tt-input" aria-label="Starting jetons per player" value={starting} onChange={(event) => setStarting(event.target.value)} />
      </label>
      {nextGame === "POKER" ? (
        <label className="tt-field">
          Dealer
          <select className="tt-input" aria-label="Poker dealer" value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
            {chosen.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="tt-label">PLAYING FOR</div>
      <div className="tt-segment" data-playing-for="true">
        <button type="button" className={stakeType === "MONEY" ? "active" : ""} onClick={() => setStakeType("MONEY")}>
          MONEY
        </button>
        <button type="button" className={stakeType === "CUSTOM" ? "active" : ""} onClick={() => setStakeType("CUSTOM")}>
          SOMETHING ELSE
        </button>
      </div>
      {stakeType === "MONEY" ? (
        <>
          <label className="tt-field">
            Currency
            <select className="tt-input" aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="GBP">GBP</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="tt-field">
            Value of one jeton
            <input className="tt-input" aria-label="Value of one jeton" value={moneyPerJeton} onChange={(event) => setMoneyPerJeton(event.target.value)} />
          </label>
          <p className="tt-muted">1 jeton = {currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{moneyPerJeton || "1"}</p>
        </>
      ) : (
        <>
          <label className="tt-field">
            Unit
            <input className="tt-input" aria-label="Custom unit label" value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} />
          </label>
          <label className="tt-field">
            Jetons per unit
            <input className="tt-input" aria-label="Jetons per custom unit" value={jetonsPerUnit} onChange={(event) => setJetonsPerUnit(event.target.value)} />
          </label>
          <p className="tt-muted">{jetonsPerUnit || "50"} jetons = 1 {customLabel || "Dinner"}</p>
        </>
      )}
      <button className="tt-btn gold" type="button" data-start-new-game="true" onClick={start}>
        START NEW GAME
      </button>
      <button className="tt-link" type="button" onClick={() => setStep("game")}>
        Back
      </button>
    </>
  );
}
