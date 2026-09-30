"use client";

import type { ReactNode } from "react";

export function PlayerRow({
  name,
  status,
  children,
  available,
  locked,
  userId,
  index,
}: {
  name: string;
  status?: string;
  children?: ReactNode;
  available?: string;
  locked?: string;
  userId?: string;
  index?: number;
}) {
  return (
    <section className="dealer-player" data-player-row="true" data-player-group={userId}>
      <header className="dealer-player-head">
        <div className="dealer-player-id">
          {index != null ? <span className="player-index">{index}</span> : null}
          <span className="player-dot" aria-hidden="true" />
          <div>
            <strong>{name}</strong>
            {status ? <div className="muted">{status}</div> : null}
          </div>
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
