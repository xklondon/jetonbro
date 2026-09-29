"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";

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
}) {
  const [name, setName] = useState(defaultTableName);
  const [hostName, setHostName] = useState(defaultHostName ?? "");
  const [startingJetonsPerPlayer, setStartingJetonsPerPlayer] = useState<string>(
    defaultStartingJetons ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const [pending, setPending] = useState(false);

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Create table</strong>
      </div>
      <main className="felt home-stack">
        <form
          className="entry-form create-table-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            try {
              await onCreate({
                name,
                game: "BLACKJACK",
                startingJetonsPerPlayer,
                emails: [],
                hostName: needsHostName ? hostName : undefined,
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
          {needsHostName ? (
            <label>
              Owner / host name
              <input
                name="hostName"
                aria-label="Owner / host name"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                required
              />
            </label>
          ) : null}
          <label>
            Starting jetons per Player
            <input
              name="startingJetonsPerPlayer"
              aria-label="Starting jetons per player"
              inputMode="numeric"
              pattern="[0-9]*"
              value={startingJetonsPerPlayer}
              onChange={(event) => setStartingJetonsPerPlayer(event.target.value)}
            />
          </label>
          <button className="gold-button" type="submit" disabled={pending}>
            {pending ? "Creating table" : "CREATE TABLE"}
          </button>
        </form>
      </main>
      <footer className="dock">
        <button className="text-link" type="button" onClick={onBack}>
          Cancel
        </button>
      </footer>
    </PhoneShell>
  );
}
