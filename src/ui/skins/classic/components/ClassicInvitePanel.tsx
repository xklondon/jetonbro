"use client";

import { useEffect, useState } from "react";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";
import type { InvitationView, MemberView } from "@/application/queries/views";
import { SheetOverlay } from "./SheetOverlay";

export type InviteTab = "guest" | "verified" | "email";

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
  selectedMethod?: InviteTab | null;
  onSelectMethod?: (tab: InviteTab) => void;
  showJoinedInEmail?: boolean;
  showPendingInEmail?: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseInviteEmails(raw: string) {
  return [...new Set(raw.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

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
  selectedMethod,
  onSelectMethod,
  showJoinedInEmail = true,
  showPendingInEmail = true,
}: InviteMethodsProps) {
  const verifiedUrl = verifiedJoinUrl ?? null;
  const [internalTab, setInternalTab] = useState<InviteTab | null>(defaultTab);
  const controlled = selectedMethod !== undefined;
  const tab = controlled ? selectedMethod : internalTab;
  const [emails, setEmails] = useState("");
  const [guestQr, setGuestQr] = useState<string | null>(null);
  const [verifiedQr, setVerifiedQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"guest" | "verified" | null>(null);
  const [emailStatus, setEmailStatus] = useState<"idle" | "invalid" | "sending" | "sent" | "error">("idle");
  const [emailMessage, setEmailMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!guestJoinUrl) {
      setGuestQr(null);
      return;
    }
    let cancelled = false;
    void joinQrDataUrl(guestJoinUrl)
      .then((url) => {
        if (!cancelled) setGuestQr(url);
      })
      .catch(() => {
        if (!cancelled) setGuestQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [guestJoinUrl]);

  useEffect(() => {
    if (!verifiedUrl) {
      setVerifiedQr(null);
      return;
    }
    let cancelled = false;
    void joinQrDataUrl(verifiedUrl)
      .then((url) => {
        if (!cancelled) setVerifiedQr(url);
      })
      .catch(() => {
        if (!cancelled) setVerifiedQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [verifiedUrl]);

  function select(next: InviteTab) {
    if (controlled) {
      onSelectMethod?.(next);
      return;
    }
    setInternalTab(next);
  }

  async function copy(kind: "guest" | "verified", url: string | null) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function sendInvite() {
    const list = parseInviteEmails(emails);
    if (list.length === 0 || list.some((email) => !EMAIL_PATTERN.test(email))) {
      setEmailStatus("invalid");
      setEmailMessage("Enter a valid email address.");
      return;
    }
    setEmailStatus("sending");
    setEmailMessage("Sending invitation…");
    try {
      const ok = await onCommand("inviteByEmail", { emails: list.join(",") });
      if (ok === false) {
        setEmailStatus("error");
        setEmailMessage(notice ?? "Invitation could not be sent.");
        return;
      }
      setEmailStatus("sent");
      setEmailMessage("Invitation sent.");
      setEmails("");
    } catch (error) {
      setEmailStatus("error");
      setEmailMessage(error instanceof Error ? error.message : "Invitation could not be sent.");
    }
  }

  const pending = (invitations ?? []).filter((invite) => invite.pending);
  const joined = (members ?? []).filter((member) => !member.isBankDealer);

  return (
    <div className="invite-methods" data-invite-inline="true" data-selected-invite={tab ?? "none"}>
      <div className="invite-tabs" role="tablist" aria-label="Invitation method">
        <button type="button" role="tab" aria-selected={tab === "guest"} className={tab === "guest" ? "active" : ""} onClick={() => select("guest")}>
          GUEST QR
        </button>
        <button type="button" role="tab" aria-selected={tab === "verified"} className={tab === "verified" ? "active" : ""} onClick={() => select("verified")}>
          VERIFIED QR
        </button>
        <button type="button" role="tab" aria-selected={tab === "email"} className={tab === "email" ? "active" : ""} onClick={() => select("email")}>
          EMAIL
        </button>
      </div>
      {tab === "guest" ? (
        <section className="invite-card invite-inline-row" data-invite-kind="guest" data-guest-join-url={guestJoinUrl ?? undefined}>
          <p className="muted">Join this table without email. Starts with {startingJetons} jetons.</p>
          {guestJoinUrl ? (
            <div className="qr-panel compact-qr" data-join-url={guestJoinUrl} aria-label="Guest QR — no email">
              {guestQr ? <img src={guestQr} alt="Guest QR — no email" width={128} height={128} /> : <div className="qr-slot muted">Preparing guest QR…</div>}
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
          <p className="muted">Confirm email to become a verified user. Completing the magic link seats them at this table.</p>
          {verifiedUrl ? (
            <div className="qr-panel compact-qr" data-join-url={verifiedUrl} aria-label="Verified QR — email confirmation">
              {verifiedQr ? <img src={verifiedQr} alt="Verified QR — email confirmation" width={128} height={128} /> : <div className="qr-slot muted">Preparing verified QR…</div>}
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
              placeholder="player@email"
              aria-label="Player email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={emails}
              onChange={(event) => {
                setEmails(event.target.value);
                if (emailStatus === "invalid" || emailStatus === "error" || emailStatus === "sent") {
                  setEmailStatus("idle");
                  setEmailMessage(null);
                }
              }}
              disabled={!emailConfigured || emailStatus === "sending"}
            />
          </label>
          <button className="gold-button" type="button" disabled={!emailConfigured || emailStatus === "sending"} onClick={() => void sendInvite()}>
            {emailStatus === "sending" ? "SENDING…" : "SEND INVITE"}
          </button>
          {!emailConfigured ? <p className="muted">Email delivery is not configured.</p> : null}
          {emailMessage ? (
            <p className={emailStatus === "error" || emailStatus === "invalid" ? "error" : "muted"} data-invite-email-status={emailStatus}>
              {emailMessage}
            </p>
          ) : null}
          {showPendingInEmail
            ? pending.map((invite) => (
                <div className="phase-zero-row member-row" key={invite.id} data-seat-status="Invited">
                  <div>
                    <strong>{invite.email ?? "Player"}</strong>
                    <div className="muted">Pending</div>
                  </div>
                </div>
              ))
            : null}
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
      <ClassicInviteMethods {...props} defaultTab={props.defaultTab ?? null} showJoinedInEmail={false} showPendingInEmail={false} />
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
