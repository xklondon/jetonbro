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

async function fundedTable() {
  const escrow = createEscrowService();
  await escrow.ensureMasterWallet(PLAYER, 200);
  await escrow.ensureMasterWallet(BANK, 200);
  await escrow.ensureMasterWallet(OTHER, 200);
  await escrow.buyIn({ userId: PLAYER, tableId: TABLE, amount: 50, actorId: PLAYER });
  await escrow.buyIn({ userId: BANK, tableId: TABLE, amount: 80, actorId: BANK });
  await escrow.buyIn({ userId: OTHER, tableId: TABLE, amount: 40, actorId: OTHER });
  return escrow;
}

async function confirmAndLock(service: ReturnType<typeof createEscrowService>, amount = 20) {
  const confirmed = await service.confirm({
    userId: PLAYER,
    tableId: TABLE,
    amount,
    actorId: PLAYER,
  });
  return service.lock({ escrowId: confirmed.id, actorId: PLAYER });
}

describe('EscrowService', () => {
  it('funds a game wallet from the master wallet at buy-in', async () => {
    const service = createEscrowService();
    await service.ensureMasterWallet(PLAYER, 100);
    const { master, game } = await service.buyIn({
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

  it('fails when locking more than the game wallet balance', async () => {
    const service = await fundedTable();
    const confirmed = await service.confirm({
      userId: PLAYER,
      tableId: TABLE,
      amount: 51,
      actorId: PLAYER,
    });
    await expect(service.lock({ escrowId: confirmed.id, actorId: PLAYER })).rejects.toBeInstanceOf(EscrowError);
    try {
      await service.lock({ escrowId: confirmed.id, actorId: PLAYER });
    } catch (err) {
      expect(err).toBeInstanceOf(EscrowError);
      expect((err as EscrowError).code).toBe('INSUFFICIENT_GAME');
    }
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(50);
    expect((await service.getEscrow(confirmed.id))?.state).toBe('CONFIRMED');
  });

  it('fails when locking the same confirmed amount twice', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 10);
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(40);
    await expect(service.lock({ escrowId: locked.id, actorId: PLAYER })).rejects.toBeInstanceOf(EscrowError);
    try {
      await service.lock({ escrowId: locked.id, actorId: PLAYER });
    } catch (err) {
      expect((err as EscrowError).code).toBe('DOUBLE_LOCK');
    }
    expect((await service.getEscrow(locked.id))?.state).toBe('LOCKED');
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(40);
  });

  it('fails RESOLVE and RELEASE when canResolve denies the actor', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 10);

    await expect(
      service.resolve({
        escrowId: locked.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
        outcome: 'win',
        counterpartyUserId: BANK,
      }),
    ).rejects.toBeInstanceOf(EscrowError);

    try {
      await service.resolve({
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

    const resolved = await service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'push',
      counterpartyUserId: BANK,
    });

    await expect(
      service.release({
        escrowId: resolved.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
      }),
    ).rejects.toBeInstanceOf(EscrowError);

    try {
      await service.release({
        escrowId: resolved.id,
        actorId: OTHER,
        protocolConfig: multiplierConfig,
        canResolve: deny,
      });
    } catch (err) {
      expect((err as EscrowError).code).toBe('UNAUTHORIZED');
    }

    expect((await service.getEscrow(resolved.id))?.state).toBe('RESOLVED');
  });

  it('suggests a multiplier payout and credits it on release', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 20);
    const resolved = await service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'win',
      counterpartyUserId: BANK,
    });
    expect(resolved.payout?.credits).toEqual([{ userId: PLAYER, amount: 40 }]);
    await service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    expect((await service.getEscrow(resolved.id))?.state).toBe('RELEASED');
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(70);
    expect((await service.getGameWallet(BANK, TABLE))?.balance).toBe(60);
  });

  it('lets an authorized actor edit the suggested payout before release', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 20);
    const resolved = await service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'win',
      counterpartyUserId: BANK,
    });
    await service.setResolvedPayout({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      credits: [{ userId: PLAYER, amount: 30 }],
      counterpartyUserId: BANK,
    });
    await service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(60);
    expect((await service.getGameWallet(BANK, TABLE))?.balance).toBe(70);
  });

  it('splits a pot evenly across declared winners', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 20);
    const resolved = await service.resolve({
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
    await service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: splitConfig,
      canResolve: allow,
    });
    expect((await service.getGameWallet(PLAYER, TABLE))?.balance).toBe(40);
    expect((await service.getGameWallet(OTHER, TABLE))?.balance).toBe(50);
  });

  it('writes an immutable ledger row for every escrow transition', async () => {
    const service = await fundedTable();
    const locked = await confirmAndLock(service, 10);
    const resolved = await service.resolve({
      escrowId: locked.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
      outcome: 'push',
      counterpartyUserId: BANK,
    });
    await service.release({
      escrowId: resolved.id,
      actorId: BANK,
      protocolConfig: multiplierConfig,
      canResolve: allow,
    });
    const rows = (await service.listLedger()).filter((row) => row.escrowId === locked.id);
    expect(rows.map((row) => row.toState)).toEqual(['CONFIRMED', 'LOCKED', 'RESOLVED', 'RELEASED']);
    expect(rows[2]?.declaredBy).toBe(BANK);
    expect(rows.every((row) => row.at && row.actorId && typeof row.amount === 'number')).toBe(true);
  });

  it('reowns a master wallet onto a new user id without creating a second wallet', async () => {
    const service = createEscrowService();
    const original = await service.ensureMasterWallet('guest:device', 25);
    const moved = await service.reownMasterWallet('guest:device', 'user-verified');
    expect(moved.id).toBe(original.id);
    expect(moved.userId).toBe('user-verified');
    expect(moved.balance).toBe(25);
    expect(await service.getMasterWallet('guest:device')).toBeUndefined();
    expect(await service.listMasterWallets()).toHaveLength(1);
    await service.ensureMasterWallet('user-verified');
    expect(await service.listMasterWallets()).toHaveLength(1);
  });
});
