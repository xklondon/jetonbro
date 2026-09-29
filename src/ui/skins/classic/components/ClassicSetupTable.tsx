"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PhaseActionDock } from "./PhaseActionDock";
import { TableIdentity } from "./TableIdentity";
import { DealerRow } from "./DealerRow";

export function ClassicSetupTable({
  view,
  onCommand,
  notice,
}: {
  view: SetupTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void | Promise<void>;
  notice?: string | null;
}) {
  const [emails, setEmails] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<"menu" | "close" | "game" | "poker" | null>(null);
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const playerSeats = view.seats.filter((seat) => seat.status !== "Bank / Dealer");
  const seatCountClass = playerSeats.length >= 3 ? "three" : playerSeats.length === 2 ? "two" : "one";

  useEffect(() => {
    if (!view.joinUrl) return;
    void import("qrcode").then((QRCode) => {
      void QRCode.toDataURL(view.joinUrl!, { margin: 1, width: 200 }).then(setQrData);
    });
  }, [view.joinUrl]);

  async function copyLink() {
    if (!view.joinUrl) return;
    await navigator.clipboard.writeText(view.joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function shareLink() {
    if (!view.joinUrl) return;
    if (navigator.share) {
      await navigator.share({ title: view.tableName, url: view.joinUrl });
      return;
    }
    await copyLink();
  }

  const inviteSheet = (
    <>
      <h3>Add Player</h3>
      <input
        placeholder="Player email"
        aria-label="Player email"
        value={emails}
        onChange={(event) => setEmails(event.target.value)}
      />
      <button
        className="gold-button"
        type="button"
        onClick={() => {
          onCommand("inviteByEmail", { emails });
          setEmails("");
          setAddOpen(false);
        }}
      >
        Invite by email
      </button>
      {view.joinUrl ? (
        <div className="qr-panel compact-qr" data-join-url={view.joinUrl} aria-label="Shared table join QR code">
          {qrData ? <img src={qrData} alt="Shared table join QR code" /> : <div className="muted">Preparing table QR…</div>}
          <div className="dealer-tools">
            <button type="button" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <button type="button" onClick={() => void shareLink()}>
              Share
            </button>
          </div>
        </div>
      ) : null}
      <button className="text-link" type="button" onClick={() => { setAddOpen(false); setQrOpen(false); }}>
        Close
      </button>
    </>
  );

  return (
    <TableShell onMenu={view.isOwner ? () => setMenuOpen("menu") : undefined}>
      <PhaseBar label="TABLE SETUP">
        <PhaseActionDock>
          {!view.canStartBetting && view.startBlockedReason ? (
            <p className="muted phase-hint">{view.startBlockedReason}</p>
          ) : null}
          <div className="setup-start">
            <button
              className="gold-button"
              type="button"
              disabled={!view.canStartBetting}
              onClick={() => onCommand("startBetting")}
            >
              START BLACKJACK
            </button>
            <button
              type="button"
              onClick={() =>
                onCommand("switchGame", {
                  game: "POKER",
                  smallBlind: "5",
                  bigBlind: "10",
                  seatOrder: view.members.map((member) => member.userId).join(","),
                })
              }
            >
              START POKER
            </button>
          </div>
        </PhaseActionDock>
      </PhaseBar>
      <main className="felt setup-felt" data-join-url={view.joinUrl ?? undefined}>
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          {notice ? <div className="error">{notice}</div> : null}
          <div className="muted">Owner · {view.ownerName}</div>
          <DealerRow name={view.bankName} />
          <div className={`setup-seats ${seatCountClass}`}>
            {playerSeats.length === 0 ? (
              <div className="box setup-seat" data-seat-status="empty">
                <strong>Player</strong>
                <span className="muted">Waiting to join</span>
              </div>
            ) : (
              playerSeats.map((seat) => (
                <div className="box setup-seat member-row" data-seat-status={seat.status} key={seat.id}>
                  <strong>{seat.name}</strong>
                  <span className="muted">{seat.status}</span>
                </div>
              ))
            )}
          </div>
          <div className="muted">Starting {view.startingJetonsPerPlayer.label}</div>
        </div>
      </main>
      <div className={`sheet${qrOpen || addOpen ? " open" : ""}`}>
        <div className="sheet-panel">{qrOpen || addOpen ? inviteSheet : null}</div>
      </div>
      <div className={`sheet${menuOpen ? " open" : ""}`}>
        <div className="sheet-panel">
          {menuOpen === "menu" ? (
            <>
              <h3>Table</h3>
              <button type="button" onClick={() => { setQrOpen(true); setMenuOpen(null); }} disabled={!view.joinUrl}>
                QR
              </button>
              <button type="button" onClick={() => { setAddOpen(true); setMenuOpen(null); }}>
                ADD PLAYER
              </button>
              {view.canSwitchGame ? (
                <button type="button" onClick={() => setMenuOpen("game")}>
                  SWITCH GAME
                </button>
              ) : null}
              <div className="field-label">OPTIONAL TOOLS</div>
              <div className="field-label">CARD ASSIST</div>
              <div className="setting-row">
                {(["OFF", "CONFIRM", "AUTO"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={(view.cardAssist ?? "OFF") === mode ? "active" : ""}
                    onClick={() => onCommand("setCardAssist", { cardAssist: mode })}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="field-label">BANK FUNDING</div>
              <div className="setting-row">
                <button
                  type="button"
                  className={(view.bankFundingMode ?? "OPEN") === "OPEN" ? "active" : ""}
                  onClick={() => onCommand("setBankFunding", { bankFundingMode: "OPEN" })}
                >
                  OPEN BANK
                </button>
                <button
                  type="button"
                  className={view.bankFundingMode === "LIMITED" ? "active" : ""}
                  onClick={() =>
                    onCommand("setBankFunding", {
                      bankFundingMode: "LIMITED",
                      startingBank: view.startingBank?.label || "500",
                    })
                  }
                >
                  LIMITED BANK
                </button>
              </div>
              <button className="gold-button" type="button" onClick={() => { onCommand("saveTable"); setMenuOpen(null); }}>
                SAVE TABLE
              </button>
              <button className="gold-button" type="button" onClick={() => setMenuOpen("close")}>
                CLOSE TABLE & SAVE BALANCES
              </button>
              <button className="text-link" type="button" onClick={() => setMenuOpen(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {menuOpen === "close" ? (
            <>
              <h3>Close this table</h3>
              <p>{view.closePreview?.confirmation ?? "Save each Player’s remaining jetons to their personal ledger and close this table?"}</p>
              {(view.closePreview?.players ?? []).map((player) => (
                <div className="member-row" key={player.userId}>
                  <div>
                    <strong>{player.name}</strong>
                    <div className="muted">Personal ledger · {player.available.label}</div>
                    <div className="muted">Locked {player.locked.label}</div>
                  </div>
                </div>
              ))}
              <button
                className="gold-button"
                type="button"
                disabled={view.closePreview?.players.some((player) => player.locked.millis !== "0") ?? false}
                onClick={() => { onCommand("closeTable"); setMenuOpen(null); }}
              >
                Confirm close
              </button>
              <button className="text-link" type="button" onClick={() => setMenuOpen("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {menuOpen === "game" ? (
            <>
              <h3>Switch game</h3>
              <button className="gold-button" type="button" onClick={() => { onCommand("switchGame", { game: "BLACKJACK" }); setMenuOpen(null); }}>
                Blackjack
              </button>
              <button className="gold-button" type="button" onClick={() => setMenuOpen("poker")}>
                Texas Hold’em
              </button>
              <button type="button" disabled>
                Zilch — Coming later
              </button>
              <button className="text-link" type="button" onClick={() => setMenuOpen(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {menuOpen === "poker" ? (
            <>
              <h3>Texas Hold’em</h3>
              <label>
                Small blind
                <input value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} aria-label="Small blind" />
              </label>
              <label>
                Big blind
                <input value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} aria-label="Big blind" />
              </label>
              {view.members.map((member, index) => (
                <div className="member-row" key={member.userId}>
                  <strong>
                    {index + 1}. {member.name}
                  </strong>
                </div>
              ))}
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("switchGame", {
                    game: "POKER",
                    smallBlind,
                    bigBlind,
                    seatOrder: view.members.map((member) => member.userId).join(","),
                  });
                  setMenuOpen(null);
                }}
              >
                SWITCH TO TEXAS HOLD’EM
              </button>
              <button className="text-link" type="button" onClick={() => setMenuOpen("game")}>
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </div>
      <footer className="dock">
        <div className="game-controls setup-dock" data-game-controls="true">
          <div className="owner-controls">
            <button type="button" onClick={() => setAddOpen(true)}>
              ADD PLAYER
            </button>
            <button type="button" onClick={() => setQrOpen(true)} disabled={!view.joinUrl}>
              QR
            </button>
          </div>
        </div>
      </footer>
    </TableShell>
  );
}
