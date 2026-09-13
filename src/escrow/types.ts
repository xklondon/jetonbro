export type WalletType = 'master' | 'game';

export type EscrowState = 'CONFIRMED' | 'LOCKED' | 'RESOLVED' | 'RELEASED';

export type PayoutRule = 'multiplier' | 'even-split';

/** Stub shape until build-order step 2 supplies real protocol configs. */
export interface ProtocolConfig {
  payoutRule: PayoutRule;
  /** Outcome key → multiplier. Used only when payoutRule is `multiplier`. */
  multipliers?: Record<string, number>;
}

export type CanResolve = (actorId: string, protocolConfig: ProtocolConfig) => boolean;

export interface Wallet {
  id: string;
  userId: string;
  type: WalletType;
  tableId: string | null;
  balance: number;
}

export interface PayoutCredit {
  userId: string;
  amount: number;
}

export interface ResolvedPayout {
  rule: PayoutRule;
  outcome?: string;
  /** Credits applied to game wallets on RELEASE. Editable before release. */
  credits: PayoutCredit[];
  /**
   * Game-wallet owner who covers a payout larger than the pot, and who
   * receives leftover pot when credits sum to less than the pot.
   */
  counterpartyUserId?: string;
}

export interface Escrow {
  id: string;
  tableId: string;
  userId: string;
  amount: number;
  state: EscrowState;
  payout?: ResolvedPayout;
  resolvedBy?: string;
}

export type LedgerKind = 'BUY_IN' | 'TRANSITION' | 'PAYOUT_ADJUST';

export interface LedgerRow {
  id: string;
  at: string;
  actorId: string;
  amount: number;
  kind: LedgerKind;
  escrowId: string | null;
  fromState: EscrowState | null;
  toState: EscrowState | null;
  /** Set on CONFIRMED→RESOLVED and LOCKED→RESOLVED; who declared the outcome. */
  declaredBy?: string;
  detail?: string;
}

export interface BuyInInput {
  userId: string;
  tableId: string;
  amount: number;
  actorId: string;
}

export interface ConfirmInput {
  userId: string;
  tableId: string;
  amount: number;
  actorId: string;
}

export interface LockInput {
  escrowId: string;
  actorId: string;
}

export interface ResolveInput {
  escrowId: string;
  actorId: string;
  protocolConfig: ProtocolConfig;
  canResolve: CanResolve;
  outcome?: string;
  winners?: string[];
  counterpartyUserId?: string;
  /** If set, used as the payout plan instead of the suggested one. */
  credits?: PayoutCredit[];
}

export interface SetResolvedPayoutInput {
  escrowId: string;
  actorId: string;
  protocolConfig: ProtocolConfig;
  canResolve: CanResolve;
  credits: PayoutCredit[];
  counterpartyUserId?: string;
}

export interface ReleaseInput {
  escrowId: string;
  actorId: string;
  protocolConfig: ProtocolConfig;
  canResolve: CanResolve;
}
