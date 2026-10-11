"use client";

/** Compact text-only dealer identity near the top rail. */
export function BlackjackDealerPosition({
  name,
  ranks,
}: {
  name: string;
  ranks?: string[];
}) {
  const dealerName = name?.trim() || "Dealer";
  return (
    <div className="pm-bj-dealer-unit" data-dealer-slot="true" aria-label={`Dealer · ${dealerName}`}>
      <span className="pm-bj-dealer-label" data-dealer-label="true">
        DEALER · {dealerName}
      </span>
      <div className="pm-bj-dealer-body">
        {ranks && ranks.length > 0 ? (
          <div className="pm-bj-cards" data-dealer-hand="true">
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
