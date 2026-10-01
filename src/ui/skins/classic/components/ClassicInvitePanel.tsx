"use client";

import { useEffect, useState } from "react";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";

export function ClassicInvitePanel({
  joinUrl,
  emailConfigured,
  startingJetons,
  onCommand,
  notice,
}: {
  joinUrl: string | null;
  emailConfigured: boolean;
  startingJetons: string;
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  const [emails, setEmails] = useState("");
  const [localName, setLocalName] = useState("");
  const [localStarting, setLocalStarting] = useState(startingJetons);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalStarting(startingJetons);
  }, [startingJetons]);

  useEffect(() => {
    if (!joinUrl) return;
    void joinQrDataUrl(joinUrl).then(setQrData);
  }, [joinUrl]);

  async function copyLink() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="invite-panel" data-join-url={joinUrl ?? undefined}>
      <h3>Invite Player</h3>
      {joinUrl ? (
        <div className="qr-panel compact-qr" data-join-url={joinUrl} aria-label="Shared table join QR code">
          {qrData ? <img src={qrData} alt="Shared table join QR code" /> : <div className="muted">Preparing table QR…</div>}
          <div className="qr-actions">
            <button className="gold-button" type="button" onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>
      ) : (
        <p className="muted">Join link is not ready yet.</p>
      )}
      <label>
        Player name
        <input
          placeholder="Player name"
          aria-label="Player name"
          value={localName}
          onChange={(event) => setLocalName(event.target.value)}
        />
      </label>
      <label>
        Starting jetons
        <input
          placeholder="Starting jetons"
          aria-label="Starting jetons"
          value={localStarting}
          onChange={(event) => setLocalStarting(event.target.value)}
        />
      </label>
      <button
        className="gold-button"
        type="button"
        onClick={() => onCommand("addPlayer", { name: localName, startingJetons: localStarting })}
      >
        Add Local Player
      </button>
      <label>
        Player email
        <input
          placeholder="Player email"
          aria-label="Player email"
          value={emails}
          onChange={(event) => setEmails(event.target.value)}
          disabled={!emailConfigured}
        />
      </label>
      {!emailConfigured ? (
        <p className="muted">Email delivery is not configured. QR and copy link still work.</p>
      ) : null}
      <button
        className="gold-button"
        type="button"
        disabled={!emailConfigured}
        onClick={() => {
          onCommand("inviteByEmail", { emails });
          setEmails("");
        }}
      >
        Invite by Email
      </button>
      {notice ? <div className="error">{notice}</div> : null}
    </div>
  );
}
