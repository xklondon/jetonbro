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
  const [showQr, setShowQr] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [minBet, setMinBet] = useState(view.minBet?.label ?? "");
  const [maxBet, setMaxBet] = useState(view.maxBet?.label ?? "");
  const [giveUser, setGiveUser] = useState(view.members[0]?.userId ?? "");
  const [giveAmount, setGiveAmount] = useState("");

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
        <span>Table setup · physical cards stay at the table</span>
      </div>
      <main className="felt">
        <div className="setup-list">
          {notice ? <div className="error">{notice}</div> : null}
          <div className="setup-card">
            <div>Game</div>
            <select
              defaultValue="BLACKJACK"
              onChange={(event) => {
                if (event.target.value !== "BLACKJACK") {
                  event.target.value = "BLACKJACK";
                  onCommand("updateSettings", { game: event.target.value });
                }
              }}
            >
              {view.gameOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.available}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="muted">Owner {view.ownerName} · Bank/Dealer {view.bankName}</div>
          </div>
          <div className="setup-card">
            <div>Blackjack payout</div>
            <select
              defaultValue={view.blackjackPayout}
              onChange={(event) => onCommand("updateSettings", { blackjackPayout: event.target.value, minBet, maxBet })}
            >
              <option value="THREE_TWO">3:2</option>
              <option value="SIX_FIVE">6:5</option>
            </select>
            <div className="exact" style={{ marginTop: 8 }}>
              <input placeholder="Min bet" value={minBet} onChange={(event) => setMinBet(event.target.value)} />
              <input placeholder="Max bet" value={maxBet} onChange={(event) => setMaxBet(event.target.value)} />
            </div>
            <button className="gold-button" type="button" onClick={() => onCommand("updateSettings", { minBet, maxBet, blackjackPayout: view.blackjackPayout })}>
              Save limits
            </button>
          </div>
          <div className="setup-card">
            <div>Give jetons</div>
            <select value={giveUser} onChange={(event) => setGiveUser(event.target.value)}>
              {view.members.map((member) => (
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
          {view.members.map((member) => (
            <div className="member-row" key={member.userId}>
              <div>
                <strong>{member.name}</strong>
                <div className="muted">
                  {member.isOwner ? "Owner" : ""}
                  {member.isBankDealer ? " Bank/Dealer" : " Player"}
                </div>
              </div>
              <div>
                <strong>{member.available?.label ?? "0"}</strong>
                {!member.isBankDealer ? (
                  <button
                    type="button"
                    className="head-button"
                    onClick={() => onCommand("assignBank", { userId: member.userId })}
                  >
                    Make Bank
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {view.invitations.filter((invite) => invite.pending).map((invite) => (
            <div className="member-row" key={invite.id}>
              <div>
                <strong>{invite.email}</strong>
                <div className="muted">Pending invitation</div>
              </div>
            </div>
          ))}
          <div className="setup-card">
            <input placeholder="Invite by email" value={emails} onChange={(event) => setEmails(event.target.value)} />
            <button className="gold-button" type="button" onClick={() => onCommand("inviteByEmail", { emails })}>
              Send email invites
            </button>
          </div>
          {showQr && qrData ? (
            <div className="qr-wrap">
              <img src={qrData} alt="Table join QR code" />
            </div>
          ) : null}
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
          {view.canStartBetting ? "Start betting" : view.startBlockedReason ?? "Start betting"}
        </button>
      </footer>
    </PhoneShell>
  );
}
