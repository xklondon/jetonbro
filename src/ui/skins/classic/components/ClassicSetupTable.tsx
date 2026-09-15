"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { ClassicCreateTable } from "./ClassicCreateTable";

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
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const playerSeats = view.seats.filter((seat) => seat.status !== "Bank / Dealer");
  const pendingEmails = view.invitations.filter((invite) => invite.pending && invite.email).map((invite) => invite.email as string);
  const initialEmails = pendingEmails.length ? pendingEmails : [""];
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

  return (
    <PhoneShell>
      <div>
      <div className="phase-head">
        <strong>{view.tableName}</strong>
        <span>Blackjack · Bank/Dealer {view.bankName}</span>
      </div>
      <div className="bank-phase-control">
        <div className="current">
          CURRENT PHASE: <strong>TABLE SETUP</strong>
        </div>
        <div className="dealer-tools setup-top-controls">
          <button type="button" onClick={() => setQrOpen(true)} disabled={!view.joinUrl}>
            QR
          </button>
          <button type="button" onClick={() => setAddOpen(true)}>
            + PLAYER
          </button>
        </div>
        <button
          className="gold-button"
          type="button"
          disabled={!view.canStartBetting}
          onClick={() => onCommand("startBetting")}
        >
          OPEN BETTING
        </button>
        {!view.canStartBetting && view.startBlockedReason ? (
          <p className="muted" style={{ textAlign: "center", marginTop: 6 }}>
            {view.startBlockedReason}
          </p>
        ) : null}
      </div>
      </div>
      <main className="felt setup-felt">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="dealer-spot">DEALER · {view.bankName}</div>
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
      </main>
      <div className={`sheet${qrOpen ? " open" : ""}`}>
        <div className="sheet-panel">
          <h3>Table QR</h3>
          {qrOpen ? (
          <div className="qr-panel compact-qr">
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
          <button className="text-link" type="button" onClick={() => setQrOpen(false)}>
            Close
          </button>
        </div>
      </div>
      <div className={`sheet${addOpen ? " open" : ""}`}>
        <div className="sheet-panel">
          <h3>Add a player</h3>
          {addOpen ? (
            <>
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
            Send invitation
          </button>
          <button className="text-link" type="button" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
            </>
          ) : null}
        </div>
      </div>
      {!view.setupCompleted ? (
        <div className="sheet open setup-mask">
          <div className="sheet-panel setup-sheet">
            <h3>Set up a table</h3>
            <ClassicCreateTable
              embedded
              defaultTableName={view.tableName}
              defaultStartingJetons={view.startingJetonsPerPlayer.label}
              initialEmails={initialEmails}
              joinUrl={view.joinUrl}
              notice={notice}
              onBack={() => void onCommand("abandonDraft")}
              onCreate={async (fields) => {
                await onCommand("finalizeSetup", {
                  name: fields.name,
                  startingJetonsPerPlayer: fields.startingJetonsPerPlayer,
                  emails: fields.emails.filter(Boolean).join(","),
                });
              }}
            />
          </div>
        </div>
      ) : null}
    </PhoneShell>
  );
}
