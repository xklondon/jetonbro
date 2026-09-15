"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { ClassicGameCards } from "./ClassicGameCards";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";

export type CreateTableFields = {
  name: string;
  game: "BLACKJACK";
  startingAllocation: string;
  blackjackPayout: "THREE_TWO" | "SIX_FIVE";
  maxBoxesPerPlayer: string;
  insuranceEnabled: boolean;
};

export function ClassicCreateTable({
  defaultTableName,
  initialGame,
  notice,
  onBack,
  onCreate,
}: {
  defaultTableName: string;
  initialGame: "BLACKJACK" | null;
  notice?: string | null;
  onBack: () => void;
  onCreate: (fields: CreateTableFields) => Promise<void>;
}) {
  const [game, setGame] = useState<"BLACKJACK" | null>(initialGame);
  const [name, setName] = useState(defaultTableName);
  const [startingAllocation, setStartingAllocation] = useState<string>(BLACKJACK_TABLE_DEFAULTS.startingAllocation);
  const [blackjackPayout, setBlackjackPayout] = useState<"THREE_TWO" | "SIX_FIVE">(
    BLACKJACK_TABLE_DEFAULTS.blackjackPayout,
  );
  const [maxBoxesPerPlayer, setMaxBoxesPerPlayer] = useState<string>(String(BLACKJACK_TABLE_DEFAULTS.maxBoxesPerPlayer));
  const [insuranceEnabled, setInsuranceEnabled] = useState<boolean>(BLACKJACK_TABLE_DEFAULTS.insuranceEnabled);
  const [pending, setPending] = useState(false);

  if (game !== "BLACKJACK") {
    return (
      <PhoneShell>
        <div className="phase-head">
          <strong>Select a game</strong>
          <span>Blackjack is ready. Poker and Zilch are coming later.</span>
        </div>
        <main className="felt home-stack">
          <ClassicGameCards selectedId={game} onSelectBlackjack={() => setGame("BLACKJACK")} />
        </main>
        <footer className="dock">
          <button className="gold-button" type="button" disabled>
            Continue
          </button>
          <button className="text-link" type="button" onClick={onBack}>
            Back
          </button>
        </footer>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Blackjack table</strong>
        <span>Set the house rules, then open the lobby. Betting starts when you say so.</span>
      </div>
      <main className="felt home-stack">
        <form
          className="entry-form create-table-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            try {
              await onCreate({
                name,
                game: "BLACKJACK",
                startingAllocation,
                blackjackPayout,
                maxBoxesPerPlayer,
                insuranceEnabled,
              });
            } finally {
              setPending(false);
            }
          }}
        >
          {notice ? <div className="error">{notice}</div> : null}
          <label>
            Table name
            <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            Starting jetons per player
            <input
              name="startingAllocation"
              inputMode="decimal"
              value={startingAllocation}
              onChange={(event) => setStartingAllocation(event.target.value)}
            />
          </label>
          <fieldset className="payout-pick">
            <legend>Blackjack payout</legend>
            <button
              type="button"
              className={blackjackPayout === "THREE_TWO" ? "is-selected" : ""}
              aria-pressed={blackjackPayout === "THREE_TWO"}
              onClick={() => setBlackjackPayout("THREE_TWO")}
            >
              3:2
            </button>
            <button
              type="button"
              className={blackjackPayout === "SIX_FIVE" ? "is-selected" : ""}
              aria-pressed={blackjackPayout === "SIX_FIVE"}
              onClick={() => setBlackjackPayout("SIX_FIVE")}
            >
              6:5
            </button>
          </fieldset>
          <label>
            Maximum boxes per player
            <input
              name="maxBoxesPerPlayer"
              type="number"
              min={1}
              max={8}
              value={maxBoxesPerPlayer}
              onChange={(event) => setMaxBoxesPerPlayer(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={`toggle-row${insuranceEnabled ? " is-on" : ""}`}
            role="switch"
            aria-checked={insuranceEnabled}
            onClick={() => setInsuranceEnabled((value) => !value)}
          >
            <span>Insurance enabled</span>
            <strong>{insuranceEnabled ? "On" : "Off"}</strong>
          </button>
          <button className="gold-button" type="submit" disabled={pending}>
            {pending ? "Opening table" : "CREATE TABLE"}
          </button>
        </form>
      </main>
      <footer className="dock">
        <button className="text-link" type="button" onClick={() => setGame(null)}>
          Back to games
        </button>
      </footer>
    </PhoneShell>
  );
}
