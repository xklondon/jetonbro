"use client";

import { useEffect, useState } from "react";
import type { SetupTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";

export function ClassicSetupTable({
  view,
  onCommand,
  notice,
}: {
  view: SetupTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [emails, setEmails] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const playersJoined = view.members.some((member) => !member.isBankDealer);

  useEffect(() => {
    if (!view.joinUrl) return;
    void import("qrcode").then((QRCode) => {
      void QRCode.toDataURL(view.joinUrl!, { margin: 1, width: 220 }).then(setQrData);
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
      <div className="phase-head">
        <strong>{view.tableName}</strong>
        <span>Blackjack · Bank/Dealer {view.bankName}</span>
      </div>
      <main className="felt home-stack waiting-room">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="setup-card">
          <div>Starting jetons per player</div>
          <strong>{view.startingJetonsPerPlayer.label}</strong>
          <p className="muted setup-defaults">Blackjack 3:2 · max {view.maxBoxesPerPlayer} boxes · Insurance {view.insuranceEnabled ? "on" : "off"}</p>
        </div>
        {view.seats.map((seat) => (
          <div className="member-row" key={seat.id}>
            <div>
              <strong>{seat.name}</strong>
              <div className="muted">{seat.status}</div>
            </div>
          </div>
        ))}
        {!playersJoined ? (
          <div className="waiting-players" aria-live="polite">
            <span className="waiting-pulse" aria-hidden="true" />
            <strong>Waiting for players…</strong>
          </div>
        ) : null}
        <div className="qr-panel">
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
        <button className="gold-button" type="button" onClick={() => setAddOpen(true)}>
          + ADD PLAYER
        </button>
        <div className={`sheet${addOpen ? " open" : ""}`}>
          <div className="sheet-panel">
            <h3>Add a player</h3>
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
          </div>
        </div>
      </main>
      <footer className="dock">
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
      </footer>
    </PhoneShell>
  );
}
