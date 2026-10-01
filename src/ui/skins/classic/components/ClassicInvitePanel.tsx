"use client";

import { useEffect, useState } from "react";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";
import type { InvitationView, MemberView } from "@/application/queries/views";

export function ClassicInvitePanel({
  guestJoinUrl,
  verifiedJoinUrl,
  emailConfigured,
  startingJetons,
  members,
  invitations,
  onCommand,
  notice,
  showLocalAdd = false,
}: {
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  joinUrl?: string | null;
  emailConfigured: boolean;
  startingJetons: string;
  members?: MemberView[];
  invitations?: InvitationView[];
  onCommand: CommandHandler;
  notice?: string | null;
  showLocalAdd?: boolean;
}) {
  const verifiedUrl = verifiedJoinUrl ?? null;
  const [emails, setEmails] = useState("");
  const [localName, setLocalName] = useState("");
  const [guestQr, setGuestQr] = useState<string | null>(null);
  const [verifiedQr, setVerifiedQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"guest" | "verified" | null>(null);

  useEffect(() => {
    if (!guestJoinUrl) {
      setGuestQr(null);
      return;
    }
    void joinQrDataUrl(guestJoinUrl).then(setGuestQr);
  }, [guestJoinUrl]);

  useEffect(() => {
    if (!verifiedUrl) {
      setVerifiedQr(null);
      return;
    }
    void joinQrDataUrl(verifiedUrl).then(setVerifiedQr);
  }, [verifiedUrl]);

  async function copy(kind: "guest" | "verified", url: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const joinedGuests = (members ?? []).filter((member) => !member.isBankDealer && member.userId);
  const pending = (invitations ?? []).filter((invite) => invite.pending);

  return (
    <div className="invite-inline">
      <section className="invite-card" data-invite-kind="guest" data-guest-join-url={guestJoinUrl ?? undefined}>
        <h3>JOIN WITHOUT EMAIL</h3>
        <p className="muted">Guest — no email. Limited to this table. Both devices need a connection. Starts with {startingJetons} jetons.</p>
        {guestJoinUrl ? (
          <div className="qr-panel compact-qr" data-join-url={guestJoinUrl} aria-label="Guest QR — no email">
            {guestQr ? <img src={guestQr} alt="Guest QR — no email" /> : <div className="muted">Preparing guest QR…</div>}
            <div className="qr-actions">
              <button className="gold-button" type="button" onClick={() => void copy("guest", guestJoinUrl)}>
                {copied === "guest" ? "Copied" : "Copy Guest Link"}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Guest link is not ready yet.</p>
        )}
        {joinedGuests.filter((member) => member.isGuest).map((member) => (
          <div className="phase-zero-row member-row" key={member.userId} data-player-row="true">
            <div>
              <strong>{member.name}</strong>
              <div className="muted">Guest</div>
            </div>
            <span>{member.available?.label ?? "0"}</span>
          </div>
        ))}
      </section>

      <section className="invite-card" data-invite-kind="verified" data-verified-join-url={verifiedUrl ?? undefined}>
        <h3>VERIFIED PLAYER</h3>
        <p className="muted">Verified — email confirmation. Scan, enter email, then confirm the magic link.</p>
        {verifiedUrl ? (
          <div className="qr-panel compact-qr" data-join-url={verifiedUrl} aria-label="Verified QR — email confirmation">
            {verifiedQr ? <img src={verifiedQr} alt="Verified QR — email confirmation" /> : <div className="muted">Preparing verified QR…</div>}
            <div className="qr-actions">
              <button className="gold-button" type="button" onClick={() => void copy("verified", verifiedUrl)}>
                {copied === "verified" ? "Copied" : "Copy Verified Link"}
              </button>
            </div>
          </div>
        ) : (
          <p className="muted">Verified link is not ready yet.</p>
        )}
        <label>
          Player email
          <input
            placeholder="one or more emails"
            aria-label="Player email"
            value={emails}
            onChange={(event) => setEmails(event.target.value)}
            disabled={!emailConfigured}
          />
        </label>
        {!emailConfigured ? (
          <p className="muted">Email delivery is not configured. Guest and verified QR still work when a connection is available.</p>
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
          SEND INVITE
        </button>
        {pending.map((invite) => (
          <div className="phase-zero-row member-row" key={invite.id} data-seat-status="Invited">
            <div>
              <strong>{invite.email ?? "Player"}</strong>
              <div className="muted">{invite.pending ? "Pending" : "Sent"}</div>
            </div>
          </div>
        ))}
      </section>

      {showLocalAdd ? (
        <section className="invite-card">
          <h3>Owner tool</h3>
          <p className="muted">Same-device name only. Use Guest QR when the other person has their own phone.</p>
          <label>
            Player name
            <input
              placeholder="Player name"
              aria-label="Player name"
              value={localName}
              onChange={(event) => setLocalName(event.target.value)}
            />
          </label>
          <button
            className="panel-button"
            type="button"
            onClick={() => onCommand("addPlayer", { name: localName, startingJetons })}
          >
            Add Local Player
          </button>
        </section>
      ) : null}
      {notice ? <div className="error">{notice}</div> : null}
    </div>
  );
}
