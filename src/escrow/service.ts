import { randomUUID } from 'node:crypto';
import { fail } from './errors.js';
import { createMemoryStore, type EscrowStore } from './store.js';
import type {
  BuyInInput,
  CanResolve,
  ConfirmInput,
  Escrow,
  LedgerKind,
  LedgerRow,
  LockInput,
  PayoutCredit,
  ProtocolConfig,
  ReleaseInput,
  ResolveInput,
  ResolvedPayout,
  SetResolvedPayoutInput,
  Wallet,
} from './types.js';

export class EscrowService {
  constructor(private readonly store: EscrowStore) {}

  ensureMasterWallet(userId: string, openingBalance = 0): Wallet {
    const existing = this.store.getMasterWallet(userId);
    if (existing) {
      return existing;
    }
    assertNonNegativeInteger(openingBalance, 'openingBalance');
    const wallet: Wallet = {
      id: randomUUID(),
      userId,
      type: 'master',
      tableId: null,
      balance: openingBalance,
    };
    this.store.insertWallet(wallet);
    return wallet;
  }

  buyIn(input: BuyInInput): { master: Wallet; game: Wallet; ledger: LedgerRow } {
    assertPositiveInteger(input.amount, 'amount');
    const master = this.requireMaster(input.userId);
    if (master.balance < input.amount) {
      fail('INSUFFICIENT_MASTER', 'Master wallet does not have enough chips for buy-in');
    }

    const nextMaster = { ...master, balance: master.balance - input.amount };
    this.store.updateWallet(nextMaster);

    let game = this.store.getGameWallet(input.userId, input.tableId);
    if (!game) {
      game = {
        id: randomUUID(),
        userId: input.userId,
        type: 'game',
        tableId: input.tableId,
        balance: 0,
      };
      this.store.insertWallet(game);
    }
    const nextGame = { ...game, balance: game.balance + input.amount };
    this.store.updateWallet(nextGame);

    const ledger = this.appendLedger({
      actorId: input.actorId,
      amount: input.amount,
      kind: 'BUY_IN',
      escrowId: null,
      fromState: null,
      toState: null,
      detail: `buy-in table=${input.tableId}`,
    });

    return { master: nextMaster, game: nextGame, ledger };
  }

  creditGame(input: BuyInInput): { game: Wallet; ledger: LedgerRow } {
    assertPositiveInteger(input.amount, 'amount');
    let game = this.store.getGameWallet(input.userId, input.tableId);
    if (!game) {
      game = {
        id: randomUUID(),
        userId: input.userId,
        type: 'game',
        tableId: input.tableId,
        balance: 0,
      };
      this.store.insertWallet(game);
    }
    const nextGame = { ...game, balance: game.balance + input.amount };
    this.store.updateWallet(nextGame);
    const ledger = this.appendLedger({
      actorId: input.actorId,
      amount: input.amount,
      kind: 'CREDIT',
      escrowId: null,
      fromState: null,
      toState: null,
      detail: `credit table=${input.tableId} user=${input.userId}`,
    });
    return { game: nextGame, ledger };
  }

  getMasterWallet(userId: string): Wallet | undefined {
    return this.store.getMasterWallet(userId);
  }

  listMasterWallets(): Wallet[] {
    return this.store.listWallets().filter((wallet) => wallet.type === 'master');
  }

  /**
   * Move a master wallet from one user id to another. Fails if the target
   * already has a different master wallet — upgrade must not duplicate.
   */
  reownMasterWallet(fromUserId: string, toUserId: string): Wallet {
    if (fromUserId === toUserId) {
      const same = this.store.getMasterWallet(fromUserId);
      if (!same) {
        fail('WALLET_NOT_FOUND', 'Master wallet not found');
      }
      return same;
    }
    const source = this.store.getMasterWallet(fromUserId);
    if (!source) {
      fail('WALLET_NOT_FOUND', 'Guest master wallet not found');
    }
    const target = this.store.getMasterWallet(toUserId);
    if (target && target.id !== source.id) {
      fail('DUPLICATE_WALLET', 'Verified identity already has a master wallet');
    }
    const next = { ...source, userId: toUserId };
    this.store.updateWallet(next);
    return next;
  }

  getGameWallet(userId: string, tableId: string): Wallet | undefined {
    return this.store.getGameWallet(userId, tableId);
  }

  getEscrow(escrowId: string): Escrow | undefined {
    return this.store.getEscrow(escrowId);
  }

  listEscrowsForTable(tableId: string): Escrow[] {
    return this.store.listEscrows().filter((escrow) => escrow.tableId === tableId);
  }

  listWalletsForUser(userId: string): Wallet[] {
    return this.store.listWallets().filter((wallet) => wallet.userId === userId);
  }

  listLedger(): LedgerRow[] {
    return this.store.listLedger();
  }

  confirm(input: ConfirmInput): Escrow {
    assertPositiveInteger(input.amount, 'amount');
    this.requireGame(input.userId, input.tableId);
    const escrow: Escrow = {
      id: randomUUID(),
      tableId: input.tableId,
      userId: input.userId,
      amount: input.amount,
      state: 'CONFIRMED',
    };
    this.store.insertEscrow(escrow);
    this.appendLedger({
      actorId: input.actorId,
      amount: input.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: null,
      toState: 'CONFIRMED',
    });
    return escrow;
  }

  lock(input: LockInput): Escrow {
    const escrow = this.requireEscrow(input.escrowId);
    if (escrow.state !== 'CONFIRMED') {
      fail('DOUBLE_LOCK', 'Only a CONFIRMED amount can be locked');
    }
    const game = this.requireGame(escrow.userId, escrow.tableId);
    if (game.balance < escrow.amount) {
      fail('INSUFFICIENT_GAME', 'Game wallet does not have enough chips to lock');
    }
    this.store.updateWallet({ ...game, balance: game.balance - escrow.amount });
    const next: Escrow = { ...escrow, state: 'LOCKED' };
    this.store.updateEscrow(next);
    this.appendLedger({
      actorId: input.actorId,
      amount: escrow.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: 'CONFIRMED',
      toState: 'LOCKED',
    });
    return next;
  }

  resolve(input: ResolveInput): Escrow {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = this.requireEscrow(input.escrowId);
    if (escrow.state !== 'LOCKED') {
      fail('INVALID_TRANSITION', 'RESOLVE requires a LOCKED escrow');
    }
    const payout = input.credits
      ? buildPayout(input.protocolConfig.payoutRule, input.credits, input.counterpartyUserId, input.outcome)
      : suggestPayout(escrow, input);
    const next: Escrow = {
      ...escrow,
      state: 'RESOLVED',
      resolvedBy: input.actorId,
      payout,
    };
    this.store.updateEscrow(next);
    this.appendLedger({
      actorId: input.actorId,
      amount: escrow.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: 'LOCKED',
      toState: 'RESOLVED',
      declaredBy: input.actorId,
      detail: payoutDetail(payout),
    });
    return next;
  }

  setResolvedPayout(input: SetResolvedPayoutInput): Escrow {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = this.requireEscrow(input.escrowId);
    if (escrow.state !== 'RESOLVED' || !escrow.payout) {
      fail('INVALID_TRANSITION', 'Payout can only be edited while RESOLVED, before release');
    }
    const payout = buildPayout(
      escrow.payout.rule,
      input.credits,
      input.counterpartyUserId ?? escrow.payout.counterpartyUserId,
      escrow.payout.outcome,
    );
    const next: Escrow = { ...escrow, payout };
    this.store.updateEscrow(next);
    this.appendLedger({
      actorId: input.actorId,
      amount: escrow.amount,
      kind: 'PAYOUT_ADJUST',
      escrowId: escrow.id,
      fromState: 'RESOLVED',
      toState: 'RESOLVED',
      declaredBy: escrow.resolvedBy,
      detail: payoutDetail(payout),
    });
    return next;
  }

  release(input: ReleaseInput): Escrow {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = this.requireEscrow(input.escrowId);
    if (escrow.state !== 'RESOLVED' || !escrow.payout) {
      fail('INVALID_TRANSITION', 'RELEASE requires a RESOLVED escrow');
    }
    applyPayout(this.store, escrow);
    const next: Escrow = { ...escrow, state: 'RELEASED' };
    this.store.updateEscrow(next);
    this.appendLedger({
      actorId: input.actorId,
      amount: escrow.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: 'RESOLVED',
      toState: 'RELEASED',
      declaredBy: escrow.resolvedBy,
    });
    return next;
  }

  private requireMaster(userId: string): Wallet {
    const wallet = this.store.getMasterWallet(userId);
    if (!wallet) {
      fail('WALLET_NOT_FOUND', 'Master wallet not found');
    }
    return wallet;
  }

  private requireGame(userId: string, tableId: string): Wallet {
    const wallet = this.store.getGameWallet(userId, tableId);
    if (!wallet) {
      fail('WALLET_NOT_FOUND', 'Game wallet not found — buy in first');
    }
    return wallet;
  }

  private requireEscrow(escrowId: string): Escrow {
    const escrow = this.store.getEscrow(escrowId);
    if (!escrow) {
      fail('ESCROW_NOT_FOUND', 'Escrow not found');
    }
    return escrow;
  }

  private appendLedger(partial: {
    actorId: string;
    amount: number;
    kind: LedgerKind;
    escrowId: string | null;
    fromState: LedgerRow['fromState'];
    toState: LedgerRow['toState'];
    declaredBy?: string;
    detail?: string;
  }): LedgerRow {
    const row: LedgerRow = {
      id: randomUUID(),
      at: new Date().toISOString(),
      ...partial,
    };
    this.store.insertLedger(row);
    return row;
  }
}

export function createEscrowService(store: EscrowStore = createMemoryStore()): EscrowService {
  return new EscrowService(store);
}

function assertAuthorized(actorId: string, protocolConfig: ProtocolConfig, canResolve: CanResolve): void {
  if (!canResolve(actorId, protocolConfig)) {
    fail('UNAUTHORIZED', 'Actor is not allowed to resolve or release this escrow');
  }
}

function suggestPayout(escrow: Escrow, input: ResolveInput): ResolvedPayout {
  if (input.protocolConfig.payoutRule === 'even-split') {
    const winners = input.winners ?? [];
    if (winners.length === 0) {
      fail('PAYOUT_INVALID', 'even-split requires at least one winner');
    }
    return buildPayout('even-split', evenSplitCredits(escrow.amount, winners), input.counterpartyUserId);
  }

  if (!input.outcome) {
    fail('PAYOUT_INVALID', 'multiplier payout requires an outcome key');
  }
  const multiplier = input.protocolConfig.multipliers?.[input.outcome];
  if (multiplier === undefined) {
    fail('PAYOUT_INVALID', `No multiplier configured for outcome "${input.outcome}"`);
  }
  const credit = escrow.amount * multiplier;
  if (!Number.isInteger(credit) || credit < 0) {
    fail('PAYOUT_INVALID', 'Suggested multiplier payout must be a non-negative integer');
  }
  return buildPayout(
    'multiplier',
    [{ userId: escrow.userId, amount: credit }],
    input.counterpartyUserId,
    input.outcome,
  );
}

function evenSplitCredits(pot: number, winners: string[]): PayoutCredit[] {
  const share = Math.floor(pot / winners.length);
  const leftover = pot - share * winners.length;
  return winners.map((userId, index) => ({
    userId,
    amount: share + (index === 0 ? leftover : 0),
  }));
}

function buildPayout(
  rule: ResolvedPayout['rule'],
  credits: PayoutCredit[],
  counterpartyUserId?: string,
  outcome?: string,
): ResolvedPayout {
  if (credits.length === 0) {
    fail('PAYOUT_INVALID', 'Payout must credit at least one game wallet');
  }
  for (const credit of credits) {
    assertNonNegativeInteger(credit.amount, 'payout amount');
  }
  return { rule, outcome, credits: credits.map((c) => ({ ...c })), counterpartyUserId };
}

function payoutDetail(payout: ResolvedPayout): string {
  const credits = payout.credits.map((c) => `${c.userId}:${c.amount}`).join(',');
  return `rule=${payout.rule} outcome=${payout.outcome ?? ''} credits=${credits}`;
}

function applyPayout(store: EscrowStore, escrow: Escrow): void {
  const payout = escrow.payout!;
  const creditTotal = payout.credits.reduce((sum, c) => sum + c.amount, 0);
  const extra = creditTotal - escrow.amount;

  if (extra > 0) {
    if (!payout.counterpartyUserId) {
      fail('PAYOUT_INVALID', 'Payout larger than pot requires a counterparty');
    }
    const source = requireGameAt(store, payout.counterpartyUserId, escrow.tableId);
    if (source.balance < extra) {
      fail('INSUFFICIENT_GAME', 'Counterparty game wallet cannot cover the payout');
    }
    store.updateWallet({ ...source, balance: source.balance - extra });
  } else if (extra < 0) {
    if (!payout.counterpartyUserId) {
      fail('PAYOUT_INVALID', 'Payout smaller than pot requires a counterparty to receive the remainder');
    }
    const sink = requireGameAt(store, payout.counterpartyUserId, escrow.tableId);
    store.updateWallet({ ...sink, balance: sink.balance + -extra });
  }

  for (const credit of payout.credits) {
    if (credit.amount === 0) {
      continue;
    }
    const dest = requireGameAt(store, credit.userId, escrow.tableId);
    store.updateWallet({ ...dest, balance: dest.balance + credit.amount });
  }
}

function requireGameAt(store: EscrowStore, userId: string, tableId: string): Wallet {
  const wallet = store.getGameWallet(userId, tableId);
  if (!wallet) {
    fail('WALLET_NOT_FOUND', `Game wallet not found for ${userId}`);
  }
  return wallet;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    fail('AMOUNT_INVALID', `${label} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    fail('AMOUNT_INVALID', `${label} must be a non-negative integer`);
  }
}
