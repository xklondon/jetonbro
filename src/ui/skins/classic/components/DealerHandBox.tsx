"use client";

export function DealerHandBox({
  name,
  status,
  available,
  limited,
}: {
  name: string;
  status: string;
  available?: string;
  limited?: boolean;
}) {
  return (
    <div className="dealer-summary" data-dealer-box="true" data-blackjack-box-row="true">
      <span className="dealer-mark">D</span>
      <div className="dealer-summary-copy">
        <span className="dealer-kicker">DEALER</span>
        <span className="hint">{name}</span>
      </div>
      <div className="dealer-summary-meta">
        {available ? <strong>{available}</strong> : null}
        {limited ? <span className="hint">LIMITED BANK</span> : null}
        <span className="hint">{status}</span>
      </div>
    </div>
  );
}
