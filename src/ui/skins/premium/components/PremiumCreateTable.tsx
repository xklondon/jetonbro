"use client";

import { useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { CasinoDock } from "./primitives/CasinoDock";

export function PremiumCreateTable({
  defaultTableName,
  notice,
  onBack,
  onCreate,
  defaultStartingJetons,
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
  const [name, setName] = useState(defaultTableName);
  const [starting, setStarting] = useState(defaultStartingJetons ?? "100");
  const [game, setGame] = useState<"BLACKJACK" | "POKER">("BLACKJACK");

  return (
    <PremiumShell
      title="CREATE TABLE"
      dock={
        <CasinoDock
          primary={{
            label: "START TABLE",
            onClick: () =>
              void onCreate({
                name,
                game,
                startingJetonsPerPlayer: starting,
                emails: [],
              }),
          }}
          secondary={{ label: "BACK", onClick: onBack }}
        />
      }
    >
      <div className="pm-panel">
        <h1>CREATE TABLE</h1>
        {notice ? <p>{notice}</p> : null}
        <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          <span>Table name</span>
          <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} aria-label="Table name" />
        </label>
        <label style={{ display: "grid", gap: 4, marginBottom: 12 }}>
          <span>Starting jetons per player</span>
          <input
            className="pm-input"
            value={starting}
            onChange={(e) => setStarting(e.target.value)}
            aria-label="Starting jetons per player"
          />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={`pm-btn ${game === "BLACKJACK" ? "is-primary" : "is-ghost"}`} onClick={() => setGame("BLACKJACK")}>
            Blackjack
          </button>
          <button type="button" className={`pm-btn ${game === "POKER" ? "is-primary" : "is-ghost"}`} onClick={() => setGame("POKER")} data-selected-game={game === "POKER" ? "POKER" : undefined}>
            Texas Hold&apos;em
          </button>
        </div>
      </div>
    </PremiumShell>
  );
}
