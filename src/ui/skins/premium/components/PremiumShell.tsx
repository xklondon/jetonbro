"use client";

import type { ReactNode } from "react";
import "../premium.css";
import { CasinoHeader } from "./primitives/CasinoHeader";

export function PremiumShell({
  title,
  balance,
  badges,
  onMenu,
  dock,
  children,
  board,
}: {
  title?: string;
  balance?: string;
  badges?: ReactNode;
  onMenu?: () => void;
  dock?: ReactNode;
  children?: ReactNode;
  board?: string;
}) {
  return (
    <div className="pm-root" data-skin="premium">
      <div className="pm-shell" data-table-board={board}>
        <CasinoHeader title={title} balance={balance} badges={badges} onMenu={onMenu} />
        <main className="pm-stage">{children}</main>
        {dock}
      </div>
    </div>
  );
}
