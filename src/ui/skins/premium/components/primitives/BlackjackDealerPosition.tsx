"use client";

export function BlackjackDealerPosition({
  name,
  ranks,
}: {
  name: string;
  ranks?: string[];
}) {
  const initial = (name || "D").slice(0, 1).toUpperCase();
  return (
    <div className="pm-bj-dealer" data-dealer-slot="true" aria-label="Dealer">
      <div className="pm-bj-dealer-ring" aria-hidden="true">
        <span>{initial}</span>
      </div>
      <small>DEALER</small>
      <strong>{name || "Dealer"}</strong>
      {ranks && ranks.length > 0 ? (
        <div className="pm-bj-dealer-cards">
          {ranks.map((rank, index) => (
            <span key={`${rank}-${index}`} className="pm-card">
              {rank}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
