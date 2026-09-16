const PHASE_RANK: Record<string, number> = {
  TABLE_SETUP: 0,
  BETTING: 1,
  PLAYING: 2,
  PAYOUT: 3,
  ROUND_COMPLETE: 4,
};

export type SnapshotOrder = {
  revision?: number;
  phase: string;
  roundNumber?: number;
};

/**
 * Apply only a newer server revision for the same table.
 * `revision` is `Table.updatedAt` from the database, never the client clock.
 */
export function shouldApplySnapshot(current: SnapshotOrder, incoming: SnapshotOrder): boolean {
  if (incoming.revision == null) return current.revision == null;
  if (current.revision == null) return true;
  if (incoming.revision !== current.revision) return incoming.revision > current.revision;
  const incomingRound = incoming.roundNumber ?? 0;
  const currentRound = current.roundNumber ?? 0;
  if (incomingRound !== currentRound) return incomingRound >= currentRound;
  return (PHASE_RANK[incoming.phase] ?? 0) >= (PHASE_RANK[current.phase] ?? 0);
}
