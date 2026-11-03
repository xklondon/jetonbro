"use client";

import { useState } from "react";
import type { HomeTableCard } from "@/application/queries/home";
import { PremiumShell } from "./PremiumShell";
import { CasinoDock } from "./primitives/CasinoDock";

export function PremiumHome({
  displayName,
  tables,
  notice,
  onCreateTable,
  onOpenTable,
  onWipeAllTables,
  canWipeAllTables,
  tableCount,
  showPersonalLedger,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCard[];
  notice?: string | null;
  onCreateTable: () => Promise<void>;
  onJoinTable: (destination: string) => void;
  onOpenTable: (tableId: string) => void;
  onTableCommand?: (
    tableId: string,
    command: "saveTable" | "closeTable" | "deleteTable" | "endAndDelete",
  ) => Promise<void>;
  onWipeAllTables?: (confirmation: string) => Promise<void>;
  canWipeAllTables?: boolean;
  tableCount?: number;
  showPersonalLedger?: boolean;
}) {
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePhrase, setWipePhrase] = useState("");

  return (
    <PremiumShell
      title="JETONBRO"
      dock={
        <CasinoDock
          primary={{ label: "CREATE TABLE", onClick: () => void onCreateTable() }}
          secondary={
            showPersonalLedger
              ? {
                  label: "GAME LEDGER",
                  onClick: () => {
                    window.location.href = "/ledger";
                  },
                }
              : null
          }
        >
          {canWipeAllTables ? (
            <button
              type="button"
              className="pm-link pm-wipe-link"
              data-wipe-all-tables="true"
              onClick={() => {
                setWipePhrase("");
                setWipeOpen(true);
              }}
            >
              WIPE ALL TABLES
            </button>
          ) : null}
        </CasinoDock>
      }
    >
      <div className="pm-panel">
        <h1>Welcome, {displayName}</h1>
        {notice ? <p data-home-notice="true">{notice}</p> : null}
        <p>{tables.length === 0 ? "No tables yet." : `${tables.length} table(s)`}</p>
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "grid", gap: 8 }}>
          {tables.map((table) => (
            <li key={table.id}>
              <button
                type="button"
                className="pm-btn is-ghost"
                style={{ width: "100%" }}
                onClick={() => onOpenTable(table.id)}
              >
                {table.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {wipeOpen ? (
        <div className="pm-sheet-mask" data-wipe-sheet="true" role="dialog" aria-modal="true" aria-labelledby="pm-wipe-title">
          <div className="pm-sheet">
            <h3 id="pm-wipe-title">WIPE ALL TABLES</h3>
            <p>
              This permanently removes every JetonBro table, including tables owned by other users. Users and personal
              ledger history are retained.
            </p>
            <p className="pm-muted">
              {tableCount ?? 0} tables will be affected. Type WIPE ALL TABLES to confirm.
            </p>
            <label className="pm-sheet-field">
              Confirmation
              <input
                className="pm-input"
                aria-label="Type WIPE ALL TABLES"
                value={wipePhrase}
                onChange={(event) => setWipePhrase(event.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="pm-console-btn is-primary"
              data-wipe-confirm="true"
              disabled={wipePhrase !== "WIPE ALL TABLES"}
              onClick={() => {
                setWipeOpen(false);
                setWipePhrase("");
                void onWipeAllTables?.("WIPE ALL TABLES");
              }}
            >
              Confirm wipe
            </button>
            <button
              type="button"
              className="pm-sheet-cancel"
              onClick={() => {
                setWipeOpen(false);
                setWipePhrase("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </PremiumShell>
  );
}
