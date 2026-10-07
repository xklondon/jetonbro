"use client";

import { useRef, useState } from "react";
import { parseJoinDestination } from "@/application/auth-urls";
import type { HomeTableCard } from "@/application/queries/home";
import { Shell } from "./Shell";
import { Sheet } from "./Sheet";

type OwnerCommand = "saveTable" | "closeTable" | "deleteTable" | "endAndDelete";
type Confirm = { tableId: string; command: "closeTable" | "deleteTable" | "endAndDelete"; title: string };

/** Saved Tables on the felt. Same props as the Classic Home. */
export function Home({
  displayName,
  tables,
  notice,
  onCreateTable,
  onJoinTable,
  onOpenTable,
  onTableCommand,
  onWipeAllTables,
  canWipeAllTables,
  tableCount,
  showPersonalLedger = true,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCard[];
  notice?: string | null;
  onCreateTable: () => Promise<void>;
  onJoinTable: (destination: string) => void;
  onOpenTable: (tableId: string) => void;
  onTableCommand?: (tableId: string, command: OwnerCommand) => Promise<void>;
  onWipeAllTables?: (confirmation: string) => Promise<void>;
  canWipeAllTables?: boolean;
  tableCount?: number;
  showPersonalLedger?: boolean;
}) {
  const empty = tables.length === 0;
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePhrase, setWipePhrase] = useState("");
  const drag = useRef<{ id: string; x: number } | null>(null);
  const confirmCard = confirm ? tables.find((table) => table.id === confirm.tableId) : null;

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

  function ask(table: HomeTableCard, command: Confirm["command"], title: string) {
    setMenuId(null);
    setRevealId(null);
    setConfirm({ tableId: table.id, command, title });
  }

  function closeSheet() {
    setJoinOpen(false);
    setConfirm(null);
    setWipeOpen(false);
    setWipePhrase("");
  }

  function ownerActions(table: HomeTableCard) {
    if (!table.isOwner) return null;
    return (
      <>
        {table.canSave ? (
          <button
            type="button"
            className="tt-btn"
            onClick={() => {
              setMenuId(null);
              setRevealId(null);
              void onTableCommand?.(table.id, "saveTable");
            }}
          >
            SAVE TABLE
          </button>
        ) : null}
        {table.canClose ? (
          <button type="button" className="tt-btn" data-home-close="true" onClick={() => ask(table, "closeTable", "CLOSE TABLE")}>
            CLOSE TABLE
          </button>
        ) : null}
        {table.canDeleteDraft || table.canDeleteArchived ? (
          <button type="button" className="tt-btn danger" data-home-delete="true" onClick={() => ask(table, "deleteTable", "DELETE TABLE")}>
            DELETE
          </button>
        ) : null}
        {table.canEndAndDelete ? (
          <button type="button" className="tt-btn danger" data-home-end-delete="true" onClick={() => ask(table, "endAndDelete", "END & DELETE")}>
            END & DELETE
          </button>
        ) : null}
      </>
    );
  }

  const rail = (
    <div className="tt-dock">
      <button className="tt-btn gold tt-home-create" type="button" disabled={creating} onClick={() => void createTable()}>
        {creating ? "Opening table" : "CREATE TABLE"}
      </button>
      {showPersonalLedger ? (
        <a className="tt-link" href="/ledger">
          GAME LEDGER
        </a>
      ) : null}
      {canWipeAllTables ? (
        <button
          className="tt-link"
          type="button"
          data-wipe-all-tables="true"
          onClick={() => {
            setWipePhrase("");
            setWipeOpen(true);
          }}
        >
          WIPE ALL TABLES
        </button>
      ) : null}
    </div>
  );

  return (
    <Shell
      rail={rail}
      feltClassName="tt-home"
      overlay={
        <Sheet open={joinOpen || Boolean(confirm) || wipeOpen} onClose={closeSheet}>
          {wipeOpen ? (
            <>
              <h3>WIPE ALL TABLES</h3>
              <p>
                This permanently removes every JetonBro table, including tables owned by other users. Users and personal
                ledger history are retained.
              </p>
              <p className="tt-muted">{tableCount ?? 0} tables will be affected. Type WIPE ALL TABLES to confirm.</p>
              <input className="tt-input" aria-label="Type WIPE ALL TABLES" value={wipePhrase} onChange={(event) => setWipePhrase(event.target.value)} />
              <button
                className="tt-btn gold"
                type="button"
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
              <button className="tt-link" type="button" onClick={closeSheet}>
                Cancel
              </button>
            </>
          ) : confirm && confirmCard ? (
            <>
              <h3>{confirm.title}</h3>
              <p>
                {confirm.command === "endAndDelete"
                  ? `${confirmCard.name} will be ended and hidden. The current hand or round will be abandoned. Ledger history is kept.`
                  : `${confirmCard.name}: ${confirmCard.closePreview?.confirmation}`}
              </p>
              <p className="tt-muted">
                {confirm.command === "endAndDelete"
                  ? "This does not settle winners or change other tables."
                  : confirmCard.closePreview?.kind === "delete-draft"
                    ? "Permanent draft deletion."
                    : confirmCard.closePreview?.kind === "delete-archived"
                      ? "Closed table removal. Ledger and rounds are kept."
                      : "Historical archival. Ledger and rounds are kept."}
              </p>
              {confirm.command !== "endAndDelete"
                ? confirmCard.closePreview?.players.map((player) => (
                    <p className="tt-muted" key={player.name}>
                      Saving {player.available}
                    </p>
                  ))
                : null}
              <button
                className="tt-btn gold"
                type="button"
                disabled={
                  confirm.command === "endAndDelete"
                    ? !confirmCard.canEndAndDelete
                    : confirm.command === "deleteTable"
                      ? !(confirmCard.canDeleteDraft || confirmCard.canDeleteArchived)
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
              <button className="tt-link" type="button" onClick={() => setConfirm(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <h3>Join a table</h3>
              <p className="tt-muted">Open a QR invite link, or paste the join code from an invitation.</p>
              <input
                className="tt-input"
                aria-label="Join code or link"
                placeholder="Join link or code"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
              />
              {joinError ? <div className="tt-error">{joinError}</div> : null}
              <button className="tt-btn gold" type="button" onClick={submitJoin}>
                Continue
              </button>
              <button className="tt-link" type="button" onClick={() => setJoinOpen(false)}>
                Cancel
              </button>
            </>
          )}
        </Sheet>
      }
    >
      <div className="tt-home-heading" data-home-heading="true">
        <h1>SAVED TABLES</h1>
        <p>{empty ? `Welcome, ${displayName}` : "Resume a table or create a new one."}</p>
      </div>
      {notice ? <div className="tt-error">{notice}</div> : null}
      {empty ? (
        <div className="tt-home-empty">
          <button className="tt-link" type="button" onClick={() => setJoinOpen(true)}>
            Have a join code?
          </button>
        </div>
      ) : (
        <div className="tt-home-list">
          {tables.map((table) => (
            <div
              className={`tt-home-swipe${revealId === table.id ? " is-open" : ""}`}
              key={table.id}
              data-table-id={table.id}
              data-closed={table.closed ? "true" : undefined}
              onPointerDown={(event) => {
                if (table.isOwner) drag.current = { id: table.id, x: event.clientX };
              }}
              onPointerMove={(event) => {
                if (!drag.current || drag.current.id !== table.id) return;
                const dx = event.clientX - drag.current.x;
                if (dx < -36) setRevealId(table.id);
                if (dx > 24) setRevealId((current) => (current === table.id ? null : current));
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
            >
              <article className={`tt-home-row${table.closed ? " is-closed" : ""}`}>
                <header>
                  <div>
                    <strong>{table.name}</strong>
                    <div className="tt-muted tt-home-state">
                      {table.headline.startsWith(table.game) ? table.headline : `${table.game} · ${table.headline}`}
                    </div>
                  </div>
                  {table.isOwner ? (
                    <button
                      type="button"
                      className="tt-home-menu"
                      aria-label="Table menu"
                      onClick={() => {
                        setRevealId(null);
                        setMenuId(menuId === table.id ? null : table.id);
                      }}
                    >
                      ⋯
                    </button>
                  ) : null}
                </header>
                {table.closed ? (
                  <div className="tt-muted">Closed</div>
                ) : (
                  <button className="tt-btn gold tt-resume" type="button" onClick={() => onOpenTable(table.id)}>
                    RESUME
                  </button>
                )}
              </article>
              {table.isOwner && revealId === table.id ? <div className="tt-home-reveal">{ownerActions(table)}</div> : null}
              {menuId === table.id && table.isOwner ? (
                <div className="tt-home-overflow">
                  {ownerActions(table)}
                  <div className="tt-muted tt-home-details" data-home-details="true">
                    {table.playerCount} {table.playerCount === 1 ? "player" : "players"}
                    {" · "}Owner · {table.ownerName}
                    {" · "}Dealer · {table.bankName}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          <button className="tt-link" type="button" onClick={() => setJoinOpen(true)}>
            Have a join code?
          </button>
        </div>
      )}
    </Shell>
  );
}
