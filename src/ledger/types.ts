export type PersonalEntryKind = 'RELEASE' | 'MANUAL_SETTLEMENT';

export interface PersonalLedgerEntry {
  id: string;
  kind: PersonalEntryKind;
  from: string;
  to: string;
  amount: number;
  tableId: string | null;
  timestamp: string;
  escrowId?: string;
  actorId?: string;
}

export type Standing =
  | { status: 'settled' }
  | { status: 'owes'; owes: string; amount: number };

export interface StandingRow {
  otherUserId: string;
  standing: Standing;
}

export interface StandingSnapshot {
  id: string;
  timestamp: string;
  userId: string;
  /** Null means every pair that user has history with. */
  otherUserId: string | null;
  standings: StandingRow[];
}
