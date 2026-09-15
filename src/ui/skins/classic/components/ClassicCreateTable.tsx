"use client";

import { useEffect, useState } from "react";
import { PhoneShell } from "./PhoneShell";
import { ClassicGameCards } from "./ClassicGameCards";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import { joinQrDataUrl } from "@/ui/core/join-qr";

export type CreateTableFields = {
  name: string;
  game: "BLACKJACK";
  startingJetonsPerPlayer: string;
  emails: string[];
};

export function ClassicCreateTable({
  defaultTableName,
  defaultStartingJetons,
  initialEmails,
  joinUrl,
  notice,
  onBack,
  onCreate,
  embedded,
}: {
  defaultTableName: string;
  defaultStartingJetons?: string;
  initialEmails?: string[];
  joinUrl?: string | null;
  notice?: string | null;
  onBack: () => void;
  onCreate: (fields: CreateTableFields) => Promise<void>;
  embedded?: boolean;
}) {
  const [game, setGame] = useState<"BLACKJACK">("BLACKJACK");
  const [name, setName] = useState(defaultTableName);
  const [startingJetonsPerPlayer, setStartingJetonsPerPlayer] = useState<string>(
    defaultStartingJetons ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
  );
  const extraInitial = (initialEmails ?? []).filter((email) => email.trim());
  const [emails, setEmails] = useState<string[]>(extraInitial.length ? extraInitial : [""]);
  const [pending, setPending] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  async function shareLink() {
    if (!joinUrl) return;
    if (navigator.share) {
      await navigator.share({ title: name, url: joinUrl });
      return;
    }
    await copyLink();
  }

  const form = (
    <form
      className="entry-form create-table-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending) return;
        setPending(true);
        try {
          await onCreate({
            name,
            game,
            startingJetonsPerPlayer,
            emails,
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="setup-sheet-body">
        {notice ? <div className="error">{notice}</div> : null}
        <div>
          <div className="field-label">Game</div>
          <ClassicGameCards selectedId={game} onSelectBlackjack={() => setGame("BLACKJACK")} compact />
        </div>
        <label>
          Table name
          <input name="name" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Starting jetons per player
          <input
            name="startingJetonsPerPlayer"
            inputMode="numeric"
            pattern="[0-9]*"
            value={startingJetonsPerPlayer}
            onChange={(event) => setStartingJetonsPerPlayer(event.target.value)}
          />
        </label>
        {joinUrl ? (
          <div className="qr-panel setup-qr" data-join-url={joinUrl} aria-label="Shared table join QR code">
            <div className="qr-kicker">SCAN TO JOIN TABLE</div>
            {qrData ? (
              <img src={qrData} width={240} height={240} alt="Shared table join QR code" />
            ) : (
              <div className="muted">Preparing table QR…</div>
            )}
            <div className="qr-actions">
              <button type="button" onClick={() => void copyLink()}>
                {copied ? "Copied" : "COPY LINK"}
              </button>
              <button type="button" onClick={() => void shareLink()}>
                SHARE
              </button>
            </div>
          </div>
        ) : null}
        <div className="setup-email">
          <div className="field-label">OR INVITE BY EMAIL</div>
          {emails.map((email, index) => (
            <div className="email-row" key={index}>
              <input
                type="email"
                autoComplete="email"
                aria-label="Player email"
                placeholder="Email"
                value={email}
                onChange={(event) =>
                  setEmails((rows) => rows.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))
                }
              />
              {emails.length > 1 ? (
                <button
                  type="button"
                  className="text-link"
                  aria-label="Remove player email"
                  onClick={() => setEmails((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="text-link add-email" onClick={() => setEmails((rows) => [...rows, ""])}>
            + ADD ANOTHER
          </button>
        </div>
      </div>
      <div className="setup-sheet-actions">
        <button className="gold-button" type="submit" disabled={pending}>
          {pending ? "Setting up table" : "SET UP TABLE"}
        </button>
        {embedded ? (
          <button className="text-link" type="button" onClick={onBack}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );

  if (embedded) {
    return form;
  }

  return (
    <PhoneShell>
      <div className="phase-head">
        <strong>Set up a table</strong>
        <span>One step. Invite friends, then run the Bank.</span>
      </div>
      <main className="felt home-stack">{form}</main>
      <footer className="dock">
        <button className="text-link" type="button" onClick={onBack}>
          Cancel
        </button>
      </footer>
    </PhoneShell>
  );
}
