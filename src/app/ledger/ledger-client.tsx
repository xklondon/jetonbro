"use client";

import { Shell } from "@/ui/skins/tabletop/components/Shell";

export type LedgerEntryView = {
  id: string;
  date: string;
  tableName: string;
  game: string;
  stakeType: string;
  startingJetons: string;
  endingJetons: string;
  netJetons: string;
  result: string;
  role: string;
  status: string;
};

export function LedgerClient({ entries }: { entries: LedgerEntryView[] }) {
  return (
    <Shell feltClassName="tt-home" title="GAME LEDGER">
      <div className="tt-home-list" data-game-ledger="true">
        <h1 className="tt-home-title">Game ledger</h1>
        {entries.length === 0 ? <p className="tt-muted">No saved games yet.</p> : null}
        {entries.map((entry) => (
          <article className="tt-home-row" key={entry.id} data-ledger-entry="true">
            <header>
              <div>
                <strong>{entry.tableName}</strong>
                <div className="tt-muted tt-home-state">
                  {new Date(entry.date).toLocaleDateString()} · {entry.game} · {entry.stakeType} · {entry.role} · {entry.status}
                </div>
              </div>
            </header>
            <p className="tt-muted">
              Start {entry.startingJetons} · End {entry.endingJetons} · Net {entry.netJetons}
            </p>
            <p data-ledger-result="true">{entry.result}</p>
          </article>
        ))}
        <a className="tt-link" href="/">
          Home
        </a>
      </div>
    </Shell>
  );
}
