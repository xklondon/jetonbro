"use client";

export function DealerHandBox({
  name,
  status,
}: {
  name: string;
  status: string;
}) {
  return (
    <div className="box dealer-box dealer-hand-row is-idle" data-dealer-box="true" data-blackjack-box-row="true">
      <span className="box-name">DEALER</span>
      <span className="hint">{name}</span>
      <span className="hint">{status}</span>
    </div>
  );
}
