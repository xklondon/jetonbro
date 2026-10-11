"use client";

import { useEffect, useState } from "react";
import type { InvitationView, MemberView } from "@/application/queries/views";
import { joinQrDataUrl } from "@/ui/core/join-qr";
import type { CommandHandler } from "@/ui/skins/types";

export type InviteTab = "guest" | "verified" | "email";

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

/** Guest QR / Verified QR / Email — same commands as Tabletop InviteMask. */
export function PremiumInviteMask({
  open,
  onClose,
  guestJoinUrl,
  verifiedJoinUrl,
  emailConfigured = true,
  startingJetons = "100",
  invitations,
  onCommand,
  notice,
  defaultTab = "guest",
}: {
  open: boolean;
  onClose: () => void;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  emailConfigured?: boolean;
  startingJetons?: string;
  members?: MemberView[];
  invitations?: InvitationView[];
  onCommand?: CommandHandler;
  notice?: string | null;
  defaultTab?: InviteTab;
}) {
  const [tab, setTab] = useState<InviteTab>(defaultTab);
  const [emails, setEmails] = useState("");
  const [copied, setCopied] = useState<"guest" | "verified" | null>(null);
  const [status, setStatus] = useState<"idle" | "invalid" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const guestQr = useQr(open && tab === "guest" ? guestJoinUrl : null);
  const verifiedQr = useQr(open && tab === "verified" ? verifiedJoinUrl : null);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  if (!open) return null;

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
    if (!onCommand) return;
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
    <div className="pm-invite" role="dialog" aria-label="Invite players" data-invite-mask="true">
      <div className="pm-invite-sheet">
        <header className="pm-invite-head">
          <h2 id="pm-invite-title">ADD PLAYER</h2>
          <button type="button" className="pm-link" onClick={onClose} aria-label="Close invite">
            Close
          </button>
        </header>
        <div className="pm-segment" role="tablist" aria-label="Invitation method">
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
              className={tab === id ? "is-active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "guest" ? (
          <section data-invite-kind="guest" data-guest-join-url={guestJoinUrl ?? undefined}>
            {guestJoinUrl ? (
              <div className="pm-invite-qr" data-join-url={guestJoinUrl} aria-label="Guest QR — no email">
                {guestQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={guestQr} alt="Guest QR — no email" width={140} height={140} />
                ) : (
                  <div className="pm-muted">Preparing guest QR…</div>
                )}
                <div>
                  <p className="pm-muted">Join without email. Starts with {startingJetons} jetons.</p>
                  <button type="button" className="pm-btn is-primary" onClick={() => void copy("guest", guestJoinUrl)}>
                    {copied === "guest" ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="pm-muted">Guest link is not ready yet.</p>
            )}
          </section>
        ) : null}
        {tab === "verified" ? (
          <section data-invite-kind="verified" data-verified-join-url={verifiedJoinUrl ?? undefined}>
            {verifiedJoinUrl ? (
              <div className="pm-invite-qr" data-join-url={verifiedJoinUrl} aria-label="Verified QR — email confirmation">
                {verifiedQr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={verifiedQr} alt="Verified QR — email confirmation" width={140} height={140} />
                ) : (
                  <div className="pm-muted">Preparing verified QR…</div>
                )}
                <div>
                  <p className="pm-muted">Confirm email to become a verified user at this table.</p>
                  <button
                    type="button"
                    className="pm-btn is-primary"
                    onClick={() => void copy("verified", verifiedJoinUrl)}
                  >
                    {copied === "verified" ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="pm-muted">Verified link is not ready yet.</p>
            )}
          </section>
        ) : null}
        {tab === "email" ? (
          <section data-invite-kind="email">
            <label className="pm-field">
              Player email
              <input
                className="pm-input"
                placeholder="player@email"
                aria-label="Player email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={emails}
                disabled={!emailConfigured || status === "sending"}
                onChange={(e) => {
                  setEmails(e.target.value);
                  if (status !== "idle") {
                    setStatus("idle");
                    setMessage(null);
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="pm-btn is-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!emailConfigured || status === "sending"}
              onClick={() => void sendInvite()}
            >
              {status === "sending" ? "SENDING…" : "SEND INVITE"}
            </button>
            {!emailConfigured ? <p className="pm-muted">Email delivery is not configured.</p> : null}
            {message ? (
              <p className={status === "error" || status === "invalid" ? "pm-error" : "pm-muted"} data-invite-email-status={status}>
                {message}
              </p>
            ) : null}
            {pending.map((invite) => (
              <div className="pm-chip-row" key={invite.id} data-seat-status="Invited">
                <strong>{invite.email ?? "Player"}</strong>
                <small>Pending</small>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
