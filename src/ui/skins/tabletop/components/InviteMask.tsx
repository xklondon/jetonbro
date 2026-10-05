"use client";

import { useEffect, useState } from "react";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";
import type { InvitationView, MemberView } from "@/application/queries/views";
import { Sheet } from "./Sheet";

export type InviteTab = "guest" | "verified" | "email";

export type InviteProps = {
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
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(raw: string) {
  return [...new Set(raw.split(/[\s,;]+/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function useQr(url: string | null | undefined) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let cancelled = false;
    void joinQrDataUrl(url)
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return qr;
}

/** Exclusive Guest QR / Verified QR / Email methods. Never shows both QR codes together. */
export function InviteMethods({
  guestJoinUrl,
  verifiedJoinUrl,
  emailConfigured,
  startingJetons,
  invitations,
  onCommand,
  notice,
  defaultTab = null,
  selectedMethod,
  onSelectMethod,
}: InviteProps) {
  const [internalTab, setInternalTab] = useState<InviteTab | null>(defaultTab);
  const controlled = selectedMethod !== undefined;
  const tab = controlled ? selectedMethod : internalTab;
  const [emails, setEmails] = useState("");
  const [copied, setCopied] = useState<"guest" | "verified" | null>(null);
  const [status, setStatus] = useState<"idle" | "invalid" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const guestQr = useQr(tab === "guest" ? guestJoinUrl : null);
  const verifiedQr = useQr(tab === "verified" ? verifiedJoinUrl : null);

  function select(next: InviteTab) {
    if (controlled) onSelectMethod?.(next);
    else setInternalTab(next);
  }

  async function copy(kind: "guest" | "verified", url: string | null | undefined) {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function sendInvite() {
    const list = parseEmails(emails);
    if (list.length === 0 || list.some((email) => !EMAIL_PATTERN.test(email))) {
      setStatus("invalid");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    setMessage("Sending invitation…");
    try {
      const ok = await onCommand("inviteByEmail", { emails: list.join(",") });
      if (ok === false) {
        setStatus("error");
        setMessage(notice ?? "Invitation could not be sent.");
        return;
      }
      setStatus("sent");
      setMessage("Invitation sent.");
      setEmails("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Invitation could not be sent.");
    }
  }

  const pending = (invitations ?? []).filter((invite) => invite.pending);

  return (
    <div className="tt-invite" data-invite-inline="true" data-selected-invite={tab ?? "none"}>
      <div className="tt-tabs" role="tablist" aria-label="Invitation method">
        {(
          [
            ["guest", "GUEST QR"],
            ["verified", "VERIFIED QR"],
            ["email", "EMAIL"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => select(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "guest" ? (
        <section className="tt-invite-panel" data-invite-kind="guest" data-guest-join-url={guestJoinUrl ?? undefined}>
          {guestJoinUrl ? (
            <div className="tt-qr-row" data-join-url={guestJoinUrl} aria-label="Guest QR — no email">
              <div className="tt-qr">
                {guestQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guestQr} alt="Guest QR — no email" width={152} height={152} />
                ) : (
                  <div className="tt-qr-slot tt-muted">Preparing guest QR…</div>
                )}
              </div>
              <div className="tt-qr-side">
                <p className="tt-muted">Join this table without email. Starts with {startingJetons} jetons.</p>
                <button className="tt-btn gold" type="button" onClick={() => void copy("guest", guestJoinUrl)}>
                  {copied === "guest" ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>
          ) : (
            <p className="tt-muted">Guest link is not ready yet.</p>
          )}
        </section>
      ) : null}
      {tab === "verified" ? (
        <section className="tt-invite-panel" data-invite-kind="verified" data-verified-join-url={verifiedJoinUrl ?? undefined}>
          {verifiedJoinUrl ? (
            <div className="tt-qr-row" data-join-url={verifiedJoinUrl} aria-label="Verified QR — email confirmation">
              <div className="tt-qr">
                {verifiedQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={verifiedQr} alt="Verified QR — email confirmation" width={152} height={152} />
                ) : (
                  <div className="tt-qr-slot tt-muted">Preparing verified QR…</div>
                )}
              </div>
              <div className="tt-qr-side">
                <p className="tt-muted">Confirm email to become a verified user. Completing the magic link seats them at this table.</p>
                <button className="tt-btn gold" type="button" onClick={() => void copy("verified", verifiedJoinUrl)}>
                  {copied === "verified" ? "Copied" : "Copy Link"}
                </button>
              </div>
            </div>
          ) : (
            <p className="tt-muted">Verified link is not ready yet.</p>
          )}
        </section>
      ) : null}
      {tab === "email" ? (
        <section className="tt-invite-panel" data-invite-kind="email">
          <div className="tt-email-row">
            <label className="tt-field">
              Player email
              <input
                className="tt-input"
                placeholder="player@email"
                aria-label="Player email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emails}
                disabled={!emailConfigured || status === "sending"}
                onChange={(event) => {
                  setEmails(event.target.value);
                  if (status === "invalid" || status === "error" || status === "sent") {
                    setStatus("idle");
                    setMessage(null);
                  }
                }}
              />
            </label>
            <button className="tt-btn gold" type="button" disabled={!emailConfigured || status === "sending"} onClick={() => void sendInvite()}>
              {status === "sending" ? "SENDING…" : "SEND INVITE"}
            </button>
          </div>
          {!emailConfigured ? <p className="tt-muted">Email delivery is not configured.</p> : null}
          {message ? (
            <p className={status === "error" || status === "invalid" ? "tt-error" : "tt-muted"} data-invite-email-status={status}>
              {message}
            </p>
          ) : null}
          {pending.map((invite) => (
            <div className="tt-chip-row" key={invite.id} data-seat-status="Invited">
              <strong>{invite.email ?? "Player"}</strong>
              <small>Pending</small>
            </div>
          ))}
        </section>
      ) : null}
      {notice ? <div className="tt-error">{notice}</div> : null}
    </div>
  );
}

/** Invitation methods without a sheet (Create Table PLAYERS section). */
export function InviteInline(props: InviteProps) {
  return (
    <div className="tt-invite-inline">
      <InviteMethods {...props} />
    </div>
  );
}

/** ADD PLAYER mask: bottom sheet with Guest QR / Verified QR / Email. */
export function InviteMask({ open, onClose, ...props }: InviteProps & { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="tt-invite-title" className="tt-invite-mask invite-mask">
      <header className="tt-sheet-head">
        <h3 id="tt-invite-title">ADD PLAYERS</h3>
        <button className="tt-link" type="button" onClick={onClose}>
          Close
        </button>
      </header>
      <InviteMethods {...props} defaultTab="guest" />
    </Sheet>
  );
}
