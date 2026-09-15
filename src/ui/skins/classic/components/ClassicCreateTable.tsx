"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { ClassicGameCards } from "./ClassicGameCards";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";

export type CreateTableFields = {
  name: string;
  game: "BLACKJACK";
  startingJetonsPerPlayer: string;
  emails: string[];
};

export function ClassicCreateTable({
  defaultTableName,
  notice,
  onBack,
  onCreate,
  embedded,
}: {
  defaultTableName: string;
  notice?: string | null;
  onBack: () => void;
  onCreate: (fields: CreateTableFields) => Promise<void>;
  embedded?: boolean;
}) {
  const [game, setGame] = useState<"BLACKJACK">("BLACKJACK");
  const [name, setName] = useState(defaultTableName);
  const [startingJetonsPerPlayer, setStartingJetonsPerPlayer] = useState<string>(
    BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const [emails, setEmails] = useState<string[]>([""]);
  const [pending, setPending] = useState(false);

  const form = (
    <form
      className="entry-form create-table-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          await onCreate({
            name,
            game,
            startingJetonsPerPlayer,
            emails,
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="setup-sheet-body">
      {notice ? <div className="error">{notice}</div> : null}
      <div>
        <div className="field-label">Game</div>
        <ClassicGameCards selectedId={game} onSelectBlackjack={() => setGame("BLACKJACK")} compact />
      </div>
      <label>
        Table name
        <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <div>
        <div className="field-label">Invite players</div>
        {emails.map((email, index) => (
          <div className="email-row" key={index}>
            <label>
              Player email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmails((rows) => rows.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))
                }
              />
            </label>
            {emails.length > 1 ? (
              <button
                type="button"
                className="text-link"
                aria-label="Remove player email"
                onClick={() => setEmails((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
              >
                Remove
              </button>
            ) : null}
          </div>
        ))}
        <button type="button" className="text-link" onClick={() => setEmails((rows) => [...rows, ""])}>
          + Add another player
        </button>
      </div>
      <label>
        Starting jetons per player
        <input
          name="startingJetonsPerPlayer"
          inputMode="numeric"
          pattern="[0-9]*"
          value={startingJetonsPerPlayer}
          onChange={(event) => setStartingJetonsPerPlayer(event.target.value)}
        />
      </label>
      <p className="muted setup-defaults">Blackjack 3:2 · max 3 boxes · Insurance on</p>
      </div>
      <div className="setup-sheet-actions">
      <button className="gold-button" type="submit" disabled={pending}>
        {pending ? "Starting table" : "START TABLE"}
      </button>
      {embedded ? (
        <button className="text-link" type="button" onClick={onBack}>
          Cancel
        </button>
      ) : null}
      </div>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Set up a table</strong>
        <span>One step. Invite friends, then run the Bank.</span>
      </div>
      <main className="felt home-stack">{form}</main>
      <footer className="dock">
        <button className="text-link" type="button" onClick={onBack}>
          Cancel
        </button>
      </footer>
    </PhoneShell>
  );
}
