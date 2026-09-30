"use client";

import { useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { WelcomeCelebration } from "./WelcomeCelebration";
import { SheetOverlay } from "./SheetOverlay";
import { parseJoinDestination } from "@/application/auth-urls";
import type { HomeTableCard } from "@/application/queries/home";

export function ClassicHome({
  displayName,
  tables,
  notice,
  onCreateTable,
  onJoinTable,
  onOpenTable,
  onTableCommand,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCard[];
  notice?: string | null;
  onCreateTable: () => Promise<void>;
  onJoinTable: (destination: string) => void;
  onOpenTable: (tableId: string) => void;
  onTableCommand?: (tableId: string, command: "saveTable" | "closeTable" | "deleteTable") => Promise<void>;
}) {
  const empty = tables.length === 0;
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [brandShimmer, setBrandShimmer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    tableId: string;
    command: "closeTable" | "deleteTable";
    title: string;
  } | null>(null);

  function submitJoin() {
    const destination = parseJoinDestination(joinValue);
    if (!destination) {
      setJoinError("Paste a join link or code from a table invitation.");
      return;
    }
    setJoinError(null);
    onJoinTable(destination);
  }

  async function createTable() {
    if (creating) return;
    setCreating(true);
    try {
      await onCreateTable();
    } finally {
      setCreating(false);
    }
  }

  const confirmCard = confirm ? tables.find((table) => table.id === confirm.tableId) : null;

  return (
    <PhoneShell
      overlay={<WelcomeCelebration onActiveChange={setBrandShimmer} />}
      brandClassName={brandShimmer ? "brand-shimmer" : undefined}
    >
      <div className="phase-head home-head-compact">
        <strong>{empty ? "JETONBRO" : "SAVED TABLES"}</strong>
        <span>{empty ? `Welcome, ${displayName}` : "Resume a table or create a new one."}</span>
      </div>
      <main className="felt home-stack">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="home-actions compact">
          <button className="gold-button home-create" type="button" disabled={creating} onClick={() => void createTable()}>
            {creating ? "Opening table" : "CREATE TABLE"}
          </button>
        </div>
        {empty ? (
          <button className="text-link" type="button" onClick={() => setJoinOpen(true)}>
            Have a join code?
          </button>
        ) : (
          <div className="home-table-list">
            {tables.map((table) => (
              <article className="home-table-card home-table-row" key={table.id} data-table-id={table.id}>
                <header className="home-table-row-head">
                  <div>
                    <strong>{table.name}</strong>
                    <div className="muted">
                      {table.game} · {table.headline}
                    </div>
                  </div>
                  {table.isOwner ? (
                    <button
                      type="button"
                      className="home-table-menu"
                      aria-label="Table menu"
                      onClick={() => setMenuId(menuId === table.id ? null : table.id)}
                    >
                      ⋯
                    </button>
                  ) : null}
                </header>
                <div className="muted home-table-meta">
                  {table.playerCount} {table.playerCount === 1 ? "player" : "players"}
                  {" · "}Owner · {table.ownerName}
                  {" · "}Dealer · {table.bankName}
                </div>
                {menuId === table.id && table.isOwner ? (
                  <div className="home-table-overflow">
                    {table.canDeleteDraft ? (
                      <button
                        type="button"
                        className="panel-button danger"
                        onClick={() => {
                          setMenuId(null);
                          setConfirm({
                            tableId: table.id,
                            command: "deleteTable",
                            title: "DELETE TABLE",
                          });
                        }}
                      >
                        DELETE
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="panel-button"
                          disabled={!table.canSave}
                          onClick={() => {
                            setMenuId(null);
                            void onTableCommand?.(table.id, "saveTable");
                          }}
                        >
                          SAVE TABLE
                        </button>
                        <button
                          type="button"
                          className="panel-button"
                          onClick={() => {
                            setMenuId(null);
                            setConfirm({
                              tableId: table.id,
                              command: "closeTable",
                              title: "CLOSE TABLE & SAVE BALANCES",
                            });
                          }}
                        >
                          CLOSE TABLE
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
                <button className="gold-button" type="button" onClick={() => onOpenTable(table.id)}>
                  RESUME
                </button>
              </article>
            ))}
          </div>
        )}
        <SheetOverlay
          open={joinOpen || Boolean(confirm)}
          onClose={() => {
            setJoinOpen(false);
            setConfirm(null);
          }}
        >
          {confirm && confirmCard ? (
            <>
              <h3>{confirm.title}</h3>
              <p>
                {confirmCard.name}: {confirmCard.closePreview?.confirmation}
              </p>
              <p className="muted">
                {confirmCard.closePreview?.kind === "delete-draft"
                  ? "Permanent draft deletion."
                  : "Historical archival. Ledger and rounds are kept."}
              </p>
              {(confirmCard.closePreview?.players ?? []).map((player) => (
                <div className="member-row" key={player.name}>
                  <div>
                    <strong>{player.name}</strong>
                    <div className="muted">Saving {player.available}</div>
                    <div className="muted">Locked {player.locked}</div>
                  </div>
                </div>
              ))}
              {confirmCard.closeBlockedReason && !(confirm.command === "deleteTable" && confirmCard.canDeleteDraft) ? (
                <div className="error">{confirmCard.closeBlockedReason}</div>
              ) : null}
              <button
                className="gold-button"
                type="button"
                disabled={
                  confirm.command === "deleteTable"
                    ? !(confirmCard.canDeleteDraft || confirmCard.canClose)
                    : !confirmCard.canClose
                }
                onClick={() => {
                  const next = confirm;
                  setConfirm(null);
                  void onTableCommand?.(next.tableId, next.command);
                }}
              >
                Confirm
              </button>
              <button className="text-link" type="button" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </SheetOverlay>
      </main>
      <footer className="dock">
        <div className="muted" style={{ textAlign: "center" }}>
          Virtual jetons only. Cards stay at the physical table.
        </div>
      </footer>
    </PhoneShell>
  );
}
