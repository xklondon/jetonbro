"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { WelcomeCelebration } from "./WelcomeCelebration";
import { ClassicCreateTable, type CreateTableFields } from "./ClassicCreateTable";
import { parseJoinDestination } from "@/application/auth-urls";

export type HomeTableCardView = {
  id: string;
  name: string;
  game: string;
  phase: string;
  playerCount: number;
  role: string;
};

function phaseLabel(phase: string): string {
  return phase.replaceAll("_", " ");
}

export function ClassicHome({
  displayName,
  defaultTableName,
  tables,
  notice,
  onSetupTable,
  onJoinTable,
  onOpenTable,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCardView[];
  notice?: string | null;
  onSetupTable: (fields: CreateTableFields) => Promise<void>;
  onJoinTable: (destination: string) => void;
  onOpenTable: (tableId: string) => void;
}) {
  const empty = tables.length === 0;
  const [setupOpen, setSetupOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [brandShimmer, setBrandShimmer] = useState(false);

  function submitJoin() {
    const destination = parseJoinDestination(joinValue);
    if (!destination) {
      setJoinError("Paste a join link or code from a table invitation.");
      return;
    }
    setJoinError(null);
    onJoinTable(destination);
  }

  return (
    <PhoneShell
      overlay={<WelcomeCelebration onActiveChange={setBrandShimmer} />}
      brandClassName={brandShimmer ? "brand-shimmer" : undefined}
    >
      <div className={`phase-head${empty ? "" : " home-head-compact"}`}>
        <strong>{empty ? `Welcome to the table, ${displayName}` : `Welcome back, ${displayName}`}</strong>
        <span>{empty ? "Pick a game, bring your friends, run the Bank." : "Return to a table or open a new one."}</span>
      </div>
      <main className="felt home-stack">
        {empty ? (
          <div className="home-actions">
            <button className="gold-button home-create" type="button" onClick={() => setSetupOpen(true)}>
              CREATE A TABLE
            </button>
            <button className="text-link" type="button" onClick={() => setJoinOpen(true)}>
              JOIN A TABLE
            </button>
          </div>
        ) : (
          <>
            <div className="home-actions compact">
              <button className="gold-button home-create" type="button" onClick={() => setSetupOpen(true)}>
                CREATE NEW TABLE
              </button>
              <button className="text-link" type="button" onClick={() => setJoinOpen(true)}>
                JOIN A TABLE
              </button>
            </div>
            <div className="home-table-list">
              {tables.map((table) => (
                <article className="home-table-card" key={table.id}>
                  <div>
                    <strong>{table.name}</strong>
                    <div className="muted">
                      {table.game} · {phaseLabel(table.phase)}
                    </div>
                    <div className="muted">
                      {table.playerCount} {table.playerCount === 1 ? "player" : "players"} · {table.role}
                    </div>
                  </div>
                  <button className="gold-button" type="button" onClick={() => onOpenTable(table.id)}>
                    RETURN TO TABLE
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
        <div className={`sheet${setupOpen ? " open" : ""}`}>
          <div className="sheet-panel setup-sheet">
            <h3>Set up a table</h3>
            <ClassicCreateTable
              embedded
              defaultTableName={defaultTableName}
              notice={notice}
              onBack={() => setSetupOpen(false)}
              onCreate={onSetupTable}
            />
          </div>
        </div>
        <div className={`sheet${joinOpen ? " open" : ""}`}>
          <div className="sheet-panel">
            <h3>Join a table</h3>
            <p className="muted">Open a QR invite link, or paste the join code from an invitation.</p>
            <input
              aria-label="Join code or link"
              placeholder="Join link or code"
              value={joinValue}
              onChange={(event) => setJoinValue(event.target.value)}
            />
            {joinError ? <div className="error">{joinError}</div> : null}
            <button className="gold-button" type="button" onClick={submitJoin}>
              Continue
            </button>
            <button className="text-link" type="button" onClick={() => setJoinOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </main>
      <footer className="dock">
        <div className="muted" style={{ textAlign: "center" }}>
          Virtual jetons only. Cards stay at the physical table.
        </div>
      </footer>
    </PhoneShell>
  );
}
