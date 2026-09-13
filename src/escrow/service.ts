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

  async ensureMasterWallet(userId: string, openingBalance = 0): Promise<Wallet> {
    const existing = await this.store.getMasterWallet(userId);
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
    await this.store.insertWallet(wallet);
    return wallet;
  }

  async buyIn(input: BuyInInput): Promise<{ master: Wallet; game: Wallet; ledger: LedgerRow }> {
    assertPositiveInteger(input.amount, 'amount');
    const master = await this.requireMaster(input.userId);
    if (master.balance < input.amount) {
      fail('INSUFFICIENT_MASTER', 'Master wallet does not have enough chips for buy-in');
    }

    const nextMaster = { ...master, balance: master.balance - input.amount };
    await this.store.updateWallet(nextMaster);

    let game = await this.store.getGameWallet(input.userId, input.tableId);
    if (!game) {
      game = {
        id: randomUUID(),
        userId: input.userId,
        type: 'game',
        tableId: input.tableId,
        balance: 0,
      };
      await this.store.insertWallet(game);
    }
    const nextGame = { ...game, balance: game.balance + input.amount };
    await this.store.updateWallet(nextGame);

    const ledger = await this.appendLedger({
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

  async creditGame(input: BuyInInput): Promise<{ game: Wallet; ledger: LedgerRow }> {
    assertPositiveInteger(input.amount, 'amount');
    let game = await this.store.getGameWallet(input.userId, input.tableId);
    if (!game) {
      game = {
        id: randomUUID(),
        userId: input.userId,
        type: 'game',
        tableId: input.tableId,
        balance: 0,
      };
      await this.store.insertWallet(game);
    }
    const nextGame = { ...game, balance: game.balance + input.amount };
    await this.store.updateWallet(nextGame);
    const ledger = await this.appendLedger({
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

  async getMasterWallet(userId: string): Promise<Wallet | undefined> {
    return this.store.getMasterWallet(userId);
  }

  async listMasterWallets(): Promise<Wallet[]> {
    return (await this.store.listWallets()).filter((wallet) => wallet.type === 'master');
  }

  /**
   * Move a master wallet from one user id to another. Fails if the target
   * already has a different master wallet — upgrade must not duplicate.
   */
  async reownMasterWallet(fromUserId: string, toUserId: string): Promise<Wallet> {
    if (fromUserId === toUserId) {
      const same = await this.store.getMasterWallet(fromUserId);
      if (!same) {
        fail('WALLET_NOT_FOUND', 'Master wallet not found');
      }
      return same;
    }
    const source = await this.store.getMasterWallet(fromUserId);
    if (!source) {
      fail('WALLET_NOT_FOUND', 'Guest master wallet not found');
    }
    const target = await this.store.getMasterWallet(toUserId);
    if (target && target.id !== source.id) {
      fail('DUPLICATE_WALLET', 'Verified identity already has a master wallet');
    }
    const next = { ...source, userId: toUserId };
    await this.store.updateWallet(next);
    return next;
  }

  async getGameWallet(userId: string, tableId: string): Promise<Wallet | undefined> {
    return this.store.getGameWallet(userId, tableId);
  }

  async getEscrow(escrowId: string): Promise<Escrow | undefined> {
    return this.store.getEscrow(escrowId);
  }

  async listEscrowsForTable(tableId: string): Promise<Escrow[]> {
    return (await this.store.listEscrows()).filter((escrow) => escrow.tableId === tableId);
  }

  async listWalletsForUser(userId: string): Promise<Wallet[]> {
    return (await this.store.listWallets()).filter((wallet) => wallet.userId === userId);
  }

  async listLedger(): Promise<LedgerRow[]> {
    return this.store.listLedger();
  }

  async confirm(input: ConfirmInput): Promise<Escrow> {
    assertPositiveInteger(input.amount, 'amount');
    await this.requireGame(input.userId, input.tableId);
    const escrow: Escrow = {
      id: randomUUID(),
      tableId: input.tableId,
      userId: input.userId,
      amount: input.amount,
      state: 'CONFIRMED',
    };
    await this.store.insertEscrow(escrow);
    await this.appendLedger({
      actorId: input.actorId,
      amount: input.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: null,
      toState: 'CONFIRMED',
    });
    return escrow;
  }

  async lock(input: LockInput): Promise<Escrow> {
    const escrow = await this.requireEscrow(input.escrowId);
    if (escrow.state !== 'CONFIRMED') {
      fail('DOUBLE_LOCK', 'Only a CONFIRMED amount can be locked');
    }
    const game = await this.requireGame(escrow.userId, escrow.tableId);
    if (game.balance < escrow.amount) {
      fail('INSUFFICIENT_GAME', 'Game wallet does not have enough chips to lock');
    }
    await this.store.updateWallet({ ...game, balance: game.balance - escrow.amount });
    const next: Escrow = { ...escrow, state: 'LOCKED' };
    await this.store.updateEscrow(next);
    await this.appendLedger({
      actorId: input.actorId,
      amount: escrow.amount,
      kind: 'TRANSITION',
      escrowId: escrow.id,
      fromState: 'CONFIRMED',
      toState: 'LOCKED',
    });
    return next;
  }

  async resolve(input: ResolveInput): Promise<Escrow> {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = await this.requireEscrow(input.escrowId);
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
    await this.store.updateEscrow(next);
    await this.appendLedger({
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

  async setResolvedPayout(input: SetResolvedPayoutInput): Promise<Escrow> {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = await this.requireEscrow(input.escrowId);
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
    await this.store.updateEscrow(next);
    await this.appendLedger({
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

  async release(input: ReleaseInput): Promise<Escrow> {
    assertAuthorized(input.actorId, input.protocolConfig, input.canResolve);
    const escrow = await this.requireEscrow(input.escrowId);
    if (escrow.state !== 'RESOLVED' || !escrow.payout) {
      fail('INVALID_TRANSITION', 'RELEASE requires a RESOLVED escrow');
    }
    await applyPayout(this.store, escrow);
    const next: Escrow = { ...escrow, state: 'RELEASED' };
    await this.store.updateEscrow(next);
    await this.appendLedger({
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

  private async requireMaster(userId: string): Promise<Wallet> {
    const wallet = await this.store.getMasterWallet(userId);
    if (!wallet) {
      fail('WALLET_NOT_FOUND', 'Master wallet not found');
    }
    return wallet;
  }

  private async requireGame(userId: string, tableId: string): Promise<Wallet> {
    const wallet = await this.store.getGameWallet(userId, tableId);
    if (!wallet) {
      fail('WALLET_NOT_FOUND', 'Game wallet not found — buy in first');
    }
    return wallet;
  }

  private async requireEscrow(escrowId: string): Promise<Escrow> {
    const escrow = await this.store.getEscrow(escrowId);
    if (!escrow) {
      fail('ESCROW_NOT_FOUND', 'Escrow not found');
    }
    return escrow;
  }

  private async appendLedger(partial: {
    actorId: string;
    amount: number;
    kind: LedgerKind;
    escrowId: string | null;
    fromState: LedgerRow['fromState'];
    toState: LedgerRow['toState'];
    declaredBy?: string;
    detail?: string;
  }): Promise<LedgerRow> {
    const row: LedgerRow = {
      id: randomUUID(),
      at: new Date().toISOString(),
      ...partial,
    };
    await this.store.insertLedger(row);
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

async function applyPayout(store: EscrowStore, escrow: Escrow): Promise<void> {
  const payout = escrow.payout!;
  const creditTotal = payout.credits.reduce((sum, c) => sum + c.amount, 0);
  const extra = creditTotal - escrow.amount;

  if (extra > 0) {
    if (!payout.counterpartyUserId) {
      fail('PAYOUT_INVALID', 'Payout larger than pot requires a counterparty');
    }
    const source = await requireGameAt(store, payout.counterpartyUserId, escrow.tableId);
    if (source.balance < extra) {
      fail('INSUFFICIENT_GAME', 'Counterparty game wallet cannot cover the payout');
    }
    await store.updateWallet({ ...source, balance: source.balance - extra });
  } else if (extra < 0) {
    if (!payout.counterpartyUserId) {
      fail('PAYOUT_INVALID', 'Payout smaller than pot requires a counterparty to receive the remainder');
    }
    const sink = await requireGameAt(store, payout.counterpartyUserId, escrow.tableId);
    await store.updateWallet({ ...sink, balance: sink.balance + -extra });
  }

  for (const credit of payout.credits) {
    if (credit.amount === 0) {
      continue;
    }
    const dest = await requireGameAt(store, credit.userId, escrow.tableId);
    await store.updateWallet({ ...dest, balance: dest.balance + credit.amount });
  }
}

async function requireGameAt(store: EscrowStore, userId: string, tableId: string): Promise<Wallet> {
  const wallet = await store.getGameWallet(userId, tableId);
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
