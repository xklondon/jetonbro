"use client";

import { useEffect, useState } from "react";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";
import type { InvitationView, MemberView } from "@/application/queries/views";
import { SheetOverlay } from "./SheetOverlay";

type InviteTab = "guest" | "verified" | "email";

type InviteMethodsProps = {
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  emailConfigured: boolean;
  startingJetons: string;
  members?: MemberView[];
  invitations?: InvitationView[];
  onCommand: CommandHandler;
  notice?: string | null;
  defaultTab?: InviteTab | null;
  showJoinedInEmail?: boolean;
};

export function ClassicInviteMethods({
  guestJoinUrl,
  verifiedJoinUrl,
  emailConfigured,
  startingJetons,
  members,
  invitations,
  onCommand,
  notice,
  defaultTab = null,
  showJoinedInEmail = true,
}: InviteMethodsProps) {
  const verifiedUrl = verifiedJoinUrl ?? null;
  const [tab, setTab] = useState<InviteTab | null>(defaultTab);
  const [emails, setEmails] = useState("");
  const [guestQr, setGuestQr] = useState<string | null>(null);
  const [verifiedQr, setVerifiedQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"guest" | "verified" | null>(null);

  useEffect(() => {
    if (!guestJoinUrl || tab !== "guest") return;
    void joinQrDataUrl(guestJoinUrl).then(setGuestQr);
  }, [guestJoinUrl, tab]);

  useEffect(() => {
    if (!verifiedUrl || tab !== "verified") return;
    void joinQrDataUrl(verifiedUrl).then(setVerifiedQr);
  }, [verifiedUrl, tab]);

  async function copy(kind: "guest" | "verified", url: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const pending = (invitations ?? []).filter((invite) => invite.pending);
  const joined = (members ?? []).filter((member) => !member.isBankDealer);

  return (
    <div className="invite-methods" data-invite-inline="true">
      <div className="invite-tabs" role="tablist" aria-label="Invitation method">
        <button type="button" role="tab" aria-selected={tab === "guest"} className={tab === "guest" ? "active" : ""} onClick={() => setTab(tab === "guest" ? null : "guest")}>
          GUEST QR
        </button>
        <button type="button" role="tab" aria-selected={tab === "verified"} className={tab === "verified" ? "active" : ""} onClick={() => setTab(tab === "verified" ? null : "verified")}>
          VERIFIED QR
        </button>
        <button type="button" role="tab" aria-selected={tab === "email"} className={tab === "email" ? "active" : ""} onClick={() => setTab(tab === "email" ? null : "email")}>
          EMAIL
        </button>
      </div>
      {tab === "guest" ? (
        <section className="invite-card invite-inline-row" data-invite-kind="guest" data-guest-join-url={guestJoinUrl ?? undefined}>
          <p className="muted">No email · starts with {startingJetons}</p>
          {guestJoinUrl ? (
            <div className="qr-panel compact-qr" data-join-url={guestJoinUrl} aria-label="Guest QR — no email">
              {guestQr ? <img src={guestQr} alt="Guest QR — no email" /> : <div className="muted">Preparing guest QR…</div>}
              <button className="gold-button" type="button" onClick={() => void copy("guest", guestJoinUrl)}>
                {copied === "guest" ? "Copied" : "Copy Link"}
              </button>
            </div>
          ) : (
            <p className="muted">Guest link is not ready yet.</p>
          )}
        </section>
      ) : null}
      {tab === "verified" ? (
        <section className="invite-card invite-inline-row" data-invite-kind="verified" data-verified-join-url={verifiedUrl ?? undefined}>
          <p className="muted">Email confirmation</p>
          {verifiedUrl ? (
            <div className="qr-panel compact-qr" data-join-url={verifiedUrl} aria-label="Verified QR — email confirmation">
              {verifiedQr ? <img src={verifiedQr} alt="Verified QR — email confirmation" /> : <div className="muted">Preparing verified QR…</div>}
              <button className="gold-button" type="button" onClick={() => void copy("verified", verifiedUrl)}>
                {copied === "verified" ? "Copied" : "Copy Link"}
              </button>
            </div>
          ) : (
            <p className="muted">Verified link is not ready yet.</p>
          )}
        </section>
      ) : null}
      {tab === "email" ? (
        <section className="invite-card invite-inline-row" data-invite-kind="email">
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
          <button
            className="gold-button"
            type="button"
            disabled={!emailConfigured}
            onClick={() => {
              onCommand("inviteByEmail", { emails });
              setEmails("");
            }}
          >
            SEND
          </button>
          {pending.map((invite) => (
            <div className="phase-zero-row member-row" key={invite.id} data-seat-status="Invited">
              <div>
                <strong>{invite.email ?? "Player"}</strong>
                <div className="muted">Pending</div>
              </div>
            </div>
          ))}
          {showJoinedInEmail
            ? joined.map((member) => (
                <div className="phase-zero-row member-row" key={member.userId} data-player-row="true">
                  <div>
                    <strong>{member.name}</strong>
                    <div className="muted">Joined</div>
                  </div>
                </div>
              ))
            : null}
        </section>
      ) : null}
      {notice ? <div className="error">{notice}</div> : null}
    </div>
  );
}

export function ClassicInviteInline(props: InviteMethodsProps) {
  return (
    <div className="invite-inline">
      <ClassicInviteMethods {...props} defaultTab={props.defaultTab ?? null} showJoinedInEmail={false} />
    </div>
  );
}

export function ClassicInviteMask({
  open,
  onClose,
  guestJoinUrl,
  verifiedJoinUrl,
  emailConfigured,
  startingJetons,
  members,
  invitations,
  onCommand,
  notice,
}: InviteMethodsProps & { open: boolean; onClose: () => void }) {
  return (
    <SheetOverlay open={open} onClose={onClose} labelledBy="invite-mask-title" panelClassName="invite-mask-panel">
      <div className="invite-mask">
        <header className="invite-mask-head">
          <h3 id="invite-mask-title">ADD PLAYERS</h3>
          <button className="text-link" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="invite-mask-body">
          <ClassicInviteMethods
            guestJoinUrl={guestJoinUrl}
            verifiedJoinUrl={verifiedJoinUrl}
            emailConfigured={emailConfigured}
            startingJetons={startingJetons}
            members={members}
            invitations={invitations}
            onCommand={onCommand}
            notice={notice}
            defaultTab="guest"
          />
        </div>
      </div>
    </SheetOverlay>
  );
}
