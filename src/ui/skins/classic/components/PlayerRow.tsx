"use client";

import type { ReactNode } from "react";

export function PlayerRow({
  name,
  status,
  children,
  available,
  locked,
  userId,
}: {
  name: string;
  status?: string;
  children?: ReactNode;
  available?: string;
  locked?: string;
  userId?: string;
}) {
  return (
    <section className="dealer-player" data-player-row="true" data-player-group={userId}>
      <header className="dealer-player-head">
        <div>
          <strong>{name}</strong>
          {status ? <div className="muted">{status}</div> : null}
        </div>
        {available || locked ? (
          <div className="dealer-player-balances">
            {available ? <span>AVAILABLE {available}</span> : null}
            {locked ? <span>LOCKED {locked}</span> : null}
          </div>
        ) : null}
      </header>
      {children}
    </section>
  );
}
