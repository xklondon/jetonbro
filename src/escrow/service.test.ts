import { describe, expect, it } from 'vitest';
import { EscrowError } from './errors.js';
import { createEscrowService } from './service.js';
import type { CanResolve, ProtocolConfig } from './types.js';

const TABLE = 'table-1';
const PLAYER = 'player-1';
const BANK = 'bank-1';
const OTHER = 'other-1';

const allow: CanResolve = () => true;
const deny: CanResolve = () => false;

const multiplierConfig: ProtocolConfig = {
  payoutRule: 'multiplier',
  multipliers: { win: 2, push: 1, lose: 0 },
};

const splitConfig: ProtocolConfig = {
  payoutRule: 'even-split',
};

function fundedTable() {
  const escrow = createEscrowService();
  escrow.ensureMasterWallet(PLAYER, 200);
  escrow.ensureMasterWallet(BANK, 200);
  escrow.ensureMasterWallet(OTHER, 200);
  escrow.buyIn({ userId: PLAYER, tableId: TABLE, amount: 50, actorId: PLAYER });
  escrow.buyIn({ userId: BANK, tableId: TABLE, amount: 80, actorId: BANK });
  escrow.buyIn({ userId: OTHER, tableId: TABLE, amount: 40, actorId: OTHER });
  return escrow;
}

function confirmAndLock(service: ReturnType<typeof createEscrowService>, amount = 20) {
  const confirmed = service.confirm({
    userId: PLAYER,
    tableId: TABLE,
    amount,
    actorId: PLAYER,
  });
  return service.lock({ escrowId: confirmed.id, actorId: PLAYER });
}

describe('EscrowService', () => {
  it('funds a game wallet from the master wallet at buy-in', () => {
    const service = createEscrowService();
    service.ensureMasterWallet(PLAYER, 100);
    const { master, game } = service.buyIn({
      userId: PLAYER,
      tableId: TABLE,
      amount: 40,
      actorId: PLAYER,
    });
    expect(master.balance).toBe(60);
    expect(game.balance).toBe(40);
    expect(game.type).toBe('game');
    expect(game.tableId).toBe(TABLE);
  });

  it('fails when locking more than the game wallet balance', () => {
    const service = fundedTable();
    const confirmed = service.confirm({
      userId: PLAYER,
      tableId: TABLE,
      amount: 51,
      actorId: PLAYER,
    });
    expect(() => service.lock({ escrowId: confirmed.id, actorId: PLAYER })).toThrow(EscrowError);
    try {
      service.lock({ escrowId: confirmed.id, actorId: PLAYER });
    } catch (err) {
      expect(err).toBeInstanceOf(EscrowError);
      expect((err as EscrowError).code).toBe('INSUFFICIENT_GAME');
    }
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(50);
    expect(service.getEscrow(confirmed.id)?.state).toBe('CONFIRMED');
  });

  it('fails when locking the same confirmed amount twice', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 10);
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(40);
    expect(() => service.lock({ escrowId: locked.id, actorId: PLAYER })).toThrow(EscrowError);
    try {
      service.lock({ escrowId: locked.id, actorId: PLAYER });
    } catch (err) {
      expect((err as EscrowError).code).toBe('DOUBLE_LOCK');
    }
    expect(service.getEscrow(locked.id)?.state).toBe('LOCKED');
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(40);
  });

  it('fails RESOLVE and RELEASE when canResolve denies the actor', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 10);

    expect(() =>
      service.resolve({
        escrowId: locked.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
        outcome: 'win',
        counterpartyUserId: BANK,
      }),
    ).toThrow(EscrowError);

    try {
      service.resolve({
        escrowId: locked.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
        outcome: 'win',
        counterpartyUserId: BANK,
      });
    } catch (err) {
      expect((err as EscrowError).code).toBe('UNAUTHORIZED');
    }

    const resolved = service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'push',
      counterpartyUserId: BANK,
    });

    expect(() =>
      service.release({
        escrowId: resolved.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
      }),
    ).toThrow(EscrowError);

    try {
      service.release({
        escrowId: resolved.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
      });
    } catch (err) {
      expect((err as EscrowError).code).toBe('UNAUTHORIZED');
    }

    expect(service.getEscrow(resolved.id)?.state).toBe('RESOLVED');
  });

  it('suggests a multiplier payout and credits it on release', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 20);
    const resolved = service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'win',
      counterpartyUserId: BANK,
    });
    expect(resolved.payout?.credits).toEqual([{ userId: PLAYER, amount: 40 }]);
    service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    expect(service.getEscrow(resolved.id)?.state).toBe('RELEASED');
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(70);
    expect(service.getGameWallet(BANK, TABLE)?.balance).toBe(60);
  });

  it('lets an authorized actor edit the suggested payout before release', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 20);
    const resolved = service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'win',
      counterpartyUserId: BANK,
    });
    service.setResolvedPayout({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      credits: [{ userId: PLAYER, amount: 30 }],
      counterpartyUserId: BANK,
    });
    service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(60);
    expect(service.getGameWallet(BANK, TABLE)?.balance).toBe(70);
  });

  it('splits a pot evenly across declared winners', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 20);
    const resolved = service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: splitConfig,
      canResolve: allow,
      winners: [PLAYER, OTHER],
    });
    expect(resolved.payout?.credits).toEqual([
      { userId: PLAYER, amount: 10 },
      { userId: OTHER, amount: 10 },
    ]);
    service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: splitConfig,
      canResolve: allow,
    });
    expect(service.getGameWallet(PLAYER, TABLE)?.balance).toBe(40);
    expect(service.getGameWallet(OTHER, TABLE)?.balance).toBe(50);
  });

  it('writes an immutable ledger row for every escrow transition', () => {
    const service = fundedTable();
    const locked = confirmAndLock(service, 10);
    const resolved = service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'push',
      counterpartyUserId: BANK,
    });
    service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    const rows = service.listLedger().filter((row) => row.escrowId === locked.id);
    expect(rows.map((row) => row.toState)).toEqual(['CONFIRMED', 'LOCKED', 'RESOLVED', 'RELEASED']);
    expect(rows[2]?.declaredBy).toBe(BANK);
    expect(rows.every((row) => row.at && row.actorId && typeof row.amount === 'number')).toBe(true);
  });

  it('reowns a master wallet onto a new user id without creating a second wallet', () => {
    const service = createEscrowService();
    const original = service.ensureMasterWallet('guest:device', 25);
    const moved = service.reownMasterWallet('guest:device', 'user-verified');
    expect(moved.id).toBe(original.id);
    expect(moved.userId).toBe('user-verified');
    expect(moved.balance).toBe(25);
    expect(service.getMasterWallet('guest:device')).toBeUndefined();
    expect(service.listMasterWallets()).toHaveLength(1);
    service.ensureMasterWallet('user-verified');
    expect(service.listMasterWallets()).toHaveLength(1);
  });
});
