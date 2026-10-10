"use client";

import type { ReactNode } from "react";

export function CasinoHeader({
  title,
  balance,
  badges,
  onMenu,
}: {
  title?: string;
  balance?: string;
  badges?: ReactNode;
  onMenu?: () => void;
}) {
  return (
    <header className="pm-header" data-premium-header="true">
      <button type="button" className="pm-menu" aria-label="Menu" disabled={!onMenu} onClick={onMenu}>
        ☰
      </button>
      <div className="pm-header-title">{title || "\u00a0"}</div>
      <div className="pm-header-meta">
        {badges}
        {balance != null ? (
          <div className="pm-balance" data-player-wallet="true">
            <small>BALANCE</small>
            <strong>{balance}</strong>
          </div>
        ) : null}
      </div>
    </header>
  );
}
