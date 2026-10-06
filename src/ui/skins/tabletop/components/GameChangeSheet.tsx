"use client";

import { useMemo, useState } from "react";
import type { GameSessionView, MemberView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { DEFAULT_STAKE_MODE, StakeModeControl, stakeModeToPayload, type StakeModeValue } from "./StakeModeControl";

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
  const [stake, setStake] = useState<StakeModeValue>(() => ({
    ...DEFAULT_STAKE_MODE,
    stakeType: session?.stakeType === "MONEY" || session?.stakeType === "CUSTOM" ? session.stakeType : "FUN_ONLY",
  }));
  const [dealerId, setDealerId] = useState(members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "");

  const chosen = useMemo(() => members.filter((member) => selected[member.userId]), [members, selected]);

  function start() {
    void onCommand("startNewGame", {
      game: nextGame,
      savePersonalLedger: savePersonal ? "true" : "false",
      startingJetonsPerPlayer: starting,
      participantUserIds: chosen.map((member) => member.userId).join(","),
      ...stakeModeToPayload(stake, starting),
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
      <StakeModeControl value={stake} startingJetons={starting} onChange={setStake} />
      <button className="tt-btn gold" type="button" data-start-new-game="true" onClick={start}>
        START NEW GAME
      </button>
      <button className="tt-link" type="button" onClick={() => setStep("game")}>
        Back
      </button>
    </>
  );
}
