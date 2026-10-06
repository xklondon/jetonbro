"use client";

import { useRef, useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { WelcomeCelebration } from "./WelcomeCelebration";
import { SheetOverlay } from "./SheetOverlay";
import { parseJoinDestination } from "@/application/auth-urls";
import type { HomeTableCard } from "@/application/queries/home";

type OwnerCommand = "saveTable" | "closeTable" | "deleteTable" | "endAndDelete";

export function ClassicHome({
  displayName,
  tables,
  notice,
  onCreateTable,
  onJoinTable,
  onOpenTable,
  onTableCommand,
  onDeleteAllMyTables,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCard[];
  notice?: string | null;
  onCreateTable: () => Promise<void>;
  onJoinTable: (destination: string) => void;
  onOpenTable: (tableId: string) => void;
  onTableCommand?: (tableId: string, command: OwnerCommand) => Promise<void>;
  onDeleteAllMyTables?: (confirmation: string) => Promise<void>;
  onWipeAllMyTables?: (confirmation: string) => Promise<void>;
  canWipeAllTables?: boolean;
  ownedTableCount?: number;
  showPersonalLedger?: boolean;
}) {
  const empty = tables.length === 0;
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [brandShimmer, setBrandShimmer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    tableId: string;
    command: "closeTable" | "deleteTable" | "endAndDelete";
    title: string;
  } | null>(null);
  const [deleteAllPhrase, setDeleteAllPhrase] = useState("");
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const drag = useRef<{ id: string; x: number; active: boolean } | null>(null);
  const ownsAny = tables.some((table) => table.isOwner);

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

  function ask(table: HomeTableCard, command: "closeTable" | "deleteTable" | "endAndDelete", title: string) {
    setMenuId(null);
    setRevealId(null);
    setConfirm({ tableId: table.id, command, title });
  }

  function ownerActions(table: HomeTableCard) {
    if (!table.isOwner) return null;
    return (
      <>
        {table.canSave ? (
          <button
            type="button"
            className="panel-button"
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
          <button type="button" className="panel-button" data-home-close="true" onClick={() => ask(table, "closeTable", "CLOSE TABLE")}>
            CLOSE TABLE
          </button>
        ) : null}
        {table.canDeleteDraft || table.canDeleteArchived ? (
          <button type="button" className="panel-button danger" data-home-delete="true" onClick={() => ask(table, "deleteTable", "DELETE TABLE")}>
            DELETE
          </button>
        ) : null}
        {table.canEndAndDelete ? (
          <button type="button" className="panel-button danger" data-home-end-delete="true" onClick={() => ask(table, "endAndDelete", "END & DELETE")}>
            END & DELETE
          </button>
        ) : null}
      </>
    );
  }

  return (
    <PhoneShell
      overlay={<WelcomeCelebration onActiveChange={setBrandShimmer} />}
      brandClassName={brandShimmer ? "brand-shimmer" : undefined}
    >
      <div className="home-heading" data-home-heading="true">
        <h1>SAVED TABLES</h1>
        <p>{empty ? `Welcome, ${displayName}` : "Resume a table or create a new one."}</p>
      </div>
      <main className="felt home-stack">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="home-actions compact">
          <button className="gold-button home-create" type="button" disabled={creating} onClick={() => void createTable()}>
            {creating ? "Opening table" : "CREATE TABLE"}
          </button>
          {ownsAny ? (
            <button
              className="text-link"
              type="button"
              data-delete-all-tables="true"
              onClick={() => {
                setDeleteAllPhrase("");
                setDeleteAllOpen(true);
              }}
            >
              DELETE ALL MY TABLES
            </button>
          ) : null}
        </div>
        {empty ? (
          <button className="text-link" type="button" onClick={() => setJoinOpen(true)}>
            Have a join code?
          </button>
        ) : (
          <div className="home-table-list">
            {tables.map((table) => (
              <div
                className={`home-table-swipe${revealId === table.id ? " is-open" : ""}`}
                key={table.id}
                data-table-id={table.id}
                data-closed={table.closed ? "true" : undefined}
                onPointerDown={(event) => {
                  if (!table.isOwner) return;
                  drag.current = { id: table.id, x: event.clientX, active: false };
                }}
                onPointerMove={(event) => {
                  if (!drag.current || drag.current.id !== table.id) return;
                  const dx = event.clientX - drag.current.x;
                  if (dx < -36) {
                    drag.current.active = true;
                    setRevealId(table.id);
                  }
                  if (dx > 24) setRevealId((current) => (current === table.id ? null : current));
                }}
                onPointerUp={() => {
                  drag.current = null;
                }}
              >
                {table.isOwner ? (
                  <div className="home-table-reveal" hidden={revealId !== table.id} aria-hidden={revealId !== table.id}>
                    {ownerActions(table)}
                  </div>
                ) : null}
                <article className={`home-table-card home-table-row${table.closed ? " is-closed" : ""}`}>
                  <header className="home-table-row-head">
                    <div>
                      <strong>{table.name}</strong>
                      <div className="muted home-table-state">
                        {table.headline.startsWith(table.game) ? table.headline : `${table.game} · ${table.headline}`}
                      </div>
                    </div>
                    {table.isOwner ? (
                      <button
                        type="button"
                        className="home-table-menu"
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
                  {menuId === table.id && table.isOwner ? (
                    <div className="home-table-overflow">
                      {ownerActions(table)}
                      <div className="home-table-details" data-home-details="true">
                        {table.playerCount} {table.playerCount === 1 ? "player" : "players"}
                        {" · "}Owner · {table.ownerName}
                        {" · "}Dealer · {table.bankName}
                      </div>
                    </div>
                  ) : null}
                  {table.closed ? (
                    <div className="muted">Closed</div>
                  ) : (
                    <button className="home-resume" type="button" onClick={() => onOpenTable(table.id)}>
                      RESUME
                    </button>
                  )}
                </article>
              </div>
            ))}
          </div>
        )}
        <SheetOverlay
          open={joinOpen || Boolean(confirm) || deleteAllOpen}
          onClose={() => {
            setJoinOpen(false);
            setConfirm(null);
            setDeleteAllOpen(false);
            setDeleteAllPhrase("");
          }}
        >
          {deleteAllOpen ? (
            <>
              <h3>DELETE ALL MY TABLES</h3>
              <p>Every table you own will be ended and hidden. Current hands are abandoned. Ledger history is kept. Other owners are not affected.</p>
              <p className="muted">Type DELETE ALL to confirm.</p>
              <input
                aria-label="Type DELETE ALL"
                value={deleteAllPhrase}
                onChange={(event) => setDeleteAllPhrase(event.target.value)}
              />
              <button
                className="gold-button"
                type="button"
                disabled={deleteAllPhrase !== "DELETE ALL"}
                onClick={() => {
                  setDeleteAllOpen(false);
                  setDeleteAllPhrase("");
                  void onDeleteAllMyTables?.("DELETE ALL");
                }}
              >
                Confirm
              </button>
              <button className="text-link" type="button" onClick={() => { setDeleteAllOpen(false); setDeleteAllPhrase(""); }}>
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
              <p className="muted">
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
                    <p className="muted" key={player.name}>
                      Saving {player.available}
                    </p>
                  ))
                : null}
              <button
                className="gold-button"
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
    </PhoneShell>
  );
}
