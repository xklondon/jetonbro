"use client";

/** Compact dealer medal attached to the top rail — reserved slot, never a floating card. */
export function BlackjackDealerPosition({
  name,
  ranks,
}: {
  name: string;
  ranks?: string[];
}) {
  const initial = (name || "D").slice(0, 1).toUpperCase();
  return (
    <div className="pm-bj-dealer-unit" data-dealer-slot="true" aria-label="Dealer">
      <span className="pm-bj-dealer-medal" aria-hidden="true">
        {initial}
      </span>
      <span className="pm-bj-dealer-name">{name || "Dealer"}</span>
      <div className="pm-bj-dealer-body">
        {ranks && ranks.length > 0 ? (
          <div className="pm-bj-cards">
            {ranks.map((rank, index) => (
              <span key={`${rank}-${index}`} className="pm-card">
                {rank}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
