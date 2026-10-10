"use client";

import type { HomeTableCard } from "@/application/queries/home";
import { PremiumShell } from "./PremiumShell";
import { CasinoDock } from "./primitives/CasinoDock";

export function PremiumHome({
  displayName,
  tables,
  notice,
  onCreateTable,
  onOpenTable,
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
  return (
    <PremiumShell
      title="JETONBRO"
      dock={
        <CasinoDock
          primary={{ label: "CREATE TABLE", onClick: () => void onCreateTable() }}
        />
      }
    >
      <div className="pm-panel">
        <h1>Welcome, {displayName}</h1>
        {notice ? <p>{notice}</p> : null}
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
    </PremiumShell>
  );
}
