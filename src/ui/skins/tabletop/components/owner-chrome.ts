import { createElement, type ReactNode } from "react";
import type { RoleBadge } from "./primitives/RoleBadges";

function GameSwitchIcon({ to }: { to: "BLACKJACK" | "POKER" }): ReactNode {
  if (to === "BLACKJACK") {
    return createElement(
      "svg",
      { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true, focusable: false },
      createElement("text", { x: 1, y: 10, fontSize: 11, fill: "currentColor" }, "♠"),
    );
  }
  return createElement(
    "svg",
    { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true, focusable: false },
    createElement("circle", { cx: 6, cy: 6, r: 5, fill: "none", stroke: "currentColor", strokeWidth: 1.2 }),
    createElement("circle", { cx: 6, cy: 6, r: 2.2, fill: "currentColor" }),
  );
}

/**
 * Owner chrome. Game badge shows the *switch target* (opposite game) at safe
 * boundaries — never a status-only “POKER” while already playing Poker.
 */
export function ownerChrome(
  isOwner: boolean,
  isDealer: boolean,
  game: "BLACKJACK" | "POKER",
  interactive: { changeDealer: boolean; changeGame: boolean },
  onDealer: () => void,
  onGame: () => void,
): RoleBadge[] {
  const badges: RoleBadge[] = [];
  if (isOwner) badges.push({ id: "owner", label: "OWNER" });
  if (isOwner || isDealer) {
    badges.push({
      id: "dealer",
      label: "DEALER",
      onClick: isOwner && interactive.changeDealer ? onDealer : undefined,
    });
  }
  if (isOwner && interactive.changeGame) {
    const target = game === "POKER" ? "BLACKJACK" : "POKER";
    badges.push({
      id: "game-switch",
      label: target,
      ariaLabel: target === "BLACKJACK" ? "Switch to Blackjack" : "Switch to Poker",
      icon: GameSwitchIcon({ to: target }),
      onClick: onGame,
    });
  }
  return badges;
}
