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
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [giveUser, setGiveUser] = useState("");
  const [giveAmount, setGiveAmount] = useState("");

  useEffect(() => {
    if (giveUser) return;
    const next = view.members.find((member) => !member.isBankDealer)?.userId;
    if (next) setGiveUser(next);
  }, [view.members, giveUser]);

  useEffect(() => {
    if (!showQr || !view.joinUrl) return;
    void import("qrcode").then((QRCode) => {
      void QRCode.toDataURL(view.joinUrl!, { margin: 1, width: 240 }).then(setQrData);
    });
  }, [showQr, view.joinUrl]);

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>{view.tableName}</strong>
        <span>Blackjack · Bank/Dealer {view.bankName}</span>
      </div>
      <main className="felt home-stack">
        {notice ? <div className="error">{notice}</div> : null}
        <div className="setup-card">
          <div>Starting jetons per player</div>
          <strong>{view.startingJetonsPerPlayer.label}</strong>
        </div>
        {view.seats.map((seat) => (
          <div className="member-row" key={seat.id}>
            <div>
              <strong>{seat.name}</strong>
              <div className="muted">{seat.status}</div>
            </div>
          </div>
        ))}
        <div className="home-actions compact">
          <button className="gold-button" type="button" onClick={() => setAddOpen(true)}>
            + ADD PLAYER
          </button>
        </div>
        {view.members.some((member) => !member.isBankDealer) ? (
          <div className="setup-card">
            <div>Give extra jetons</div>
            <select value={giveUser} onChange={(event) => setGiveUser(event.target.value)}>
              {view.members
                .filter((member) => !member.isBankDealer)
                .map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
            </select>
            <input placeholder="Jeton amount" value={giveAmount} onChange={(event) => setGiveAmount(event.target.value)} />
            <button className="gold-button" type="button" onClick={() => onCommand("giveJetons", { userId: giveUser, amount: giveAmount })}>
              Give jetons
            </button>
          </div>
        ) : null}
        {showQr && qrData ? (
          <div className="qr-wrap">
            <img src={qrData} alt="Table join QR code" />
          </div>
        ) : null}
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
            <button
              className="gold-button"
              type="button"
              onClick={() => {
                setShowQr(true);
                setAddOpen(false);
              }}
            >
              Show QR / share link
            </button>
            <button className="text-link" type="button" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      </main>
      <footer className="dock">
        <div className="dealer-tools" style={{ marginBottom: 8 }}>
          <button type="button" onClick={() => setShowQr((value) => !value)}>
            {showQr ? "Hide QR" : "Show QR"}
          </button>
          <button type="button" onClick={() => onCommand("rotateQr")}>
            Rotate join link
          </button>
        </div>
        <button
          className="gold-button"
          type="button"
          disabled={!view.canStartBetting}
          onClick={() => onCommand("startBetting")}
        >
          {view.canStartBetting ? "START BETTING" : view.startBlockedReason ?? "START BETTING"}
        </button>
      </footer>
    </PhoneShell>
  );
}
