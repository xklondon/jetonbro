"use client";

/** Compact Setup joined-Player indicator on the felt — never a spreadsheet/READY row. */
export function JoinedPlayerMark({
  name,
  availableLabel,
  membershipId,
}: {
  name: string;
  availableLabel: string;
  membershipId?: string;
}) {
  return (
    <div
      className="tt-bj-joined"
      data-player-row="true"
      data-joined-player="true"
      data-membership-id={membershipId}
      data-status="PLAYER_JOINED"
    >
      <span className="tt-bj-joined-chip" aria-hidden="true">
        <span className="tt-bj-joined-chip-face">{(name || "P").slice(0, 1).toUpperCase()}</span>
      </span>
      <div className="tt-bj-joined-copy">
        <strong className="tt-bj-joined-name">{name || "Player"}</strong>
        <span className="tt-bj-joined-stack" data-field="available">
          {availableLabel} jetons
        </span>
        <span className="tt-bj-joined-badge" data-field="status">
          ✓ PLAYER JOINED
        </span>
      </div>
    </div>
  );
}
