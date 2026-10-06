import type { RoleBadge } from "./primitives/RoleBadges";

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
  badges.push({
    id: "game",
    label: game,
    onClick: isOwner && interactive.changeGame ? onGame : undefined,
  });
  return badges;
}
