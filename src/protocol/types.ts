import type { PayoutRule } from '../escrow/types.js';

export type ProtocolId = 'blackjack' | 'poker' | 'zilch';

export type AuthorityMode = 'standing' | 'rotating';

export type TurnEnforcement = 'required' | 'display-only';

export type ProtocolRole = 'bank' | 'dealer' | 'turn-holder' | 'player' | 'other-players' | 'table-owner';

export type AfterRotateTurn = 'authority' | 'next-after-authority' | 'first';

export interface ProtocolAction {
  id: string;
  phase: string;
  role: ProtocolRole;
  nextPhase?: string;
  /** Advance the current-turn pointer after a successful action. */
  advanceTurn?: boolean;
  /** Rotate bank/dealer when the table's effective authority mode is rotating. */
  rotateAuthority?: boolean;
  afterRotateTurn?: AfterRotateTurn;
  requiresFlag?: string;
  setFlags?: Record<string, boolean>;
  /** Player action that ignores turn-order even when enforcement is required. */
  ignoreTurn?: boolean;
}

export interface ProtocolConfig {
  id: ProtocolId;
  authorityMode: AuthorityMode;
  authorityModeEditable: boolean;
  turnEnforcement: TurnEnforcement;
  payoutRule: PayoutRule;
  multipliers?: Record<string, number>;
  phases: string[];
  actions: ProtocolAction[];
}

export interface ProtocolTableState {
  tableId: string;
  protocolId: ProtocolId;
  phase: string;
  playerIds: string[];
  currentTurnIndex: number;
  authorityIndex: number;
  authorityMode: AuthorityMode;
  standingAuthorityUserId: string | null;
  tableOwnerUserId: string | null;
  flags: Record<string, boolean>;
  /** Whose box is being acted on (blackjack UI pointer; not an enforcement gate). */
  activeSeatUserId: string | null;
}
