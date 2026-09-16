export type StreetPlayer = {
  playerId: string;
  status: "ACTIVE" | "FOLDED" | "ALL_IN";
  streetContributionMillis: bigint;
  hasActedThisStreet: boolean;
};

export function livePlayers(players: StreetPlayer[]): StreetPlayer[] {
  return players.filter((player) => player.status !== "FOLDED");
}

export function actorsWhoCanBet(players: StreetPlayer[]): StreetPlayer[] {
  return players.filter((player) => player.status === "ACTIVE");
}

export function onlyOneLive(players: StreetPlayer[]): boolean {
  return livePlayers(players).length === 1;
}

export function allLiveAllIn(players: StreetPlayer[]): boolean {
  const live = livePlayers(players);
  return live.length >= 2 && live.every((player) => player.status === "ALL_IN");
}

export function stillNeedsToAct(player: StreetPlayer, streetWagerMillis: bigint): boolean {
  return player.status === "ACTIVE" && (!player.hasActedThisStreet || player.streetContributionMillis < streetWagerMillis);
}

export function streetIsComplete(players: StreetPlayer[], streetWagerMillis: bigint): boolean {
  if (onlyOneLive(players)) return true;
  const actors = actorsWhoCanBet(players);
  if (actors.length === 0) return livePlayers(players).length > 0;
  return actors.every(
    (player) => player.hasActedThisStreet && player.streetContributionMillis === streetWagerMillis,
  );
}
