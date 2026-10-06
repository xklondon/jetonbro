"use client";

export type RoleBadge = {
  id: string;
  label: string;
  onClick?: () => void;
};

/** Compact header badges. Interactive only when onClick is provided. */
export function RoleBadges({ badges }: { badges: RoleBadge[] }) {
  if (!badges.length) return null;
  return (
    <div className="tt-badges" data-role-badges="true">
      {badges.map((badge) =>
        badge.onClick ? (
          <button
            key={badge.id}
            type="button"
            className="tt-badge is-action"
            data-role-badge={badge.id}
            onClick={badge.onClick}
          >
            {badge.label}
          </button>
        ) : (
          <span key={badge.id} className="tt-badge" data-role-badge={badge.id}>
            {badge.label}
          </span>
        ),
      )}
    </div>
  );
}
