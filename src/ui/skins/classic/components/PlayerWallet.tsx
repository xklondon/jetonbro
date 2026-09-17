"use client";

import type { MoneyView } from "@/application/queries/views";
import { JetonTray } from "./JetonTray";

export function PlayerWallet({
  available,
  trayEnabled,
  dropSelector,
  onTap,
  onDrop,
  onHover,
}: {
  available: MoneyView;
  trayEnabled: boolean;
  dropSelector: string;
  onTap?: (amount: string) => void;
  onDrop?: (amount: string, targetId: string) => void;
  onHover?: (targetId: string | null) => void;
}) {
  return (
    <div className="player-wallet" data-player-wallet="true">
      <div className="wallet-bar">
        <small>YOUR JETONS</small>
        <div className="wallet-available">
          <small>AVAILABLE</small>
          <strong>{available.label}</strong>
        </div>
      </div>
      <JetonTray
        enabled={trayEnabled}
        dropSelector={dropSelector}
        onTap={(amount) => onTap?.(amount)}
        onDrop={(amount, targetId) => onDrop?.(amount, targetId)}
        onHover={onHover}
      />
    </div>
  );
}
