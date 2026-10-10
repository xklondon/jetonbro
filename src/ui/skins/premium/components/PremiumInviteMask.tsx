"use client";

export function PremiumInviteMask({
  open,
  onClose,
  guestJoinUrl,
  verifiedJoinUrl,
}: {
  open: boolean;
  onClose: () => void;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
}) {
  if (!open) return null;
  return (
    <div className="pm-invite" role="dialog" aria-label="Invite players">
      <div className="pm-invite-sheet">
        <h2>ADD PLAYER</h2>
        <p style={{ margin: "0 0 12px", color: "rgba(244,234,213,0.7)", fontSize: 13 }}>
          Share a join link. Guest: {guestJoinUrl ? "ready" : "unavailable"}. Verified:{" "}
          {verifiedJoinUrl ? "ready" : "unavailable"}.
        </p>
        <button type="button" className="pm-btn is-primary" style={{ width: "100%" }} onClick={onClose}>
          CLOSE
        </button>
      </div>
    </div>
  );
}
