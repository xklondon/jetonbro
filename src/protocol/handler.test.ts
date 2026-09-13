import { describe, expect, it } from 'vitest';
import { createEscrowService } from '../escrow/index.js';
import { canResolveForTable } from './authority.js';
import { BLACKJACK_PROTOCOL, POKER_PROTOCOL, ZILCH_PROTOCOL } from './configs.js';
import { ProtocolError } from './errors.js';
import { applyAction, assertActionAllowed } from './handler.js';
import { createProtocolTable, getAuthorityUserId, getCurrentTurnUserId } from './table.js';

const P1 = 'p1';
const P2 = 'p2';
const P3 = 'p3';
const BANK = 'bank';

function codeOf(run: () => void): string {
  try {
    run();
    throw new Error('expected ProtocolError');
  } catch (err) {
    expect(err).toBeInstanceOf(ProtocolError);
    return (err as ProtocolError).code;
  }
}

describe('protocol action phases', () => {
  it('rejects blackjack Double before betting is closed', () => {
    let table = createProtocolTable({
      tableId: 'bj-1',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    table = applyAction(table, BANK, 'open-betting');
    expect(table.phase).toBe('betting-open');
    table = applyAction(table, P1, 'bet', { amount: 10 });
    expect(codeOf(() => assertActionAllowed(table, P1, 'double'))).toBe('ACTION_PHASE');

    table = applyAction(table, BANK, 'close-betting');
    expect(codeOf(() => assertActionAllowed(table, P1, 'double'))).toBe('ACTION_PHASE');

    table = applyAction(table, BANK, 'signal-cards-dealt');
    expect(table.phase).toBe('post-deal');
    expect(() => assertActionAllowed(table, P1, 'double')).not.toThrow();
  });

  it('rejects poker declare-winners before showdown', () => {
    let table = createProtocolTable({
      tableId: 'pk-1',
      protocol: POKER_PROTOCOL,
      playerIds: [P1, P2, P3],
    });
    table = applyAction(table, P1, 'start-hand');
    expect(codeOf(() => assertActionAllowed(table, P1, 'declare-winners'))).toBe('ACTION_PHASE');
    table = applyAction(table, P1, 'begin-betting');
    expect(codeOf(() => assertActionAllowed(table, P1, 'declare-winners'))).toBe('ACTION_PHASE');
    table = applyAction(table, P1, 'begin-showdown');
    expect(() => assertActionAllowed(table, P1, 'declare-winners')).not.toThrow();
  });

  it('rejects zilch declare-outcome before turn resolution', () => {
    let table = createProtocolTable({
      tableId: 'z-1',
      protocol: ZILCH_PROTOCOL,
      playerIds: [P1, P2],
    });
    table = applyAction(table, P1, 'start-turn');
    expect(codeOf(() => assertActionAllowed(table, P1, 'declare-outcome'))).toBe('ACTION_PHASE');
    table = applyAction(table, P1, 'begin-resolution');
    expect(() => assertActionAllowed(table, P1, 'declare-outcome')).not.toThrow();
  });
});

describe('turn-order enforcement', () => {
  it('rejects a poker action from a player who does not hold the turn', () => {
    let table = createProtocolTable({
      tableId: 'pk-turn',
      protocol: POKER_PROTOCOL,
      playerIds: [P1, P2, P3],
    });
    table = applyAction(table, P1, 'start-hand');
    table = applyAction(table, P1, 'begin-betting');
    expect(getCurrentTurnUserId(table)).toBe(P1);
    expect(codeOf(() => assertActionAllowed(table, P2, 'bet'))).toBe('TURN_ORDER');
    table = applyAction(table, P1, 'bet');
    expect(getCurrentTurnUserId(table)).toBe(P2);
    expect(() => assertActionAllowed(table, P2, 'call')).not.toThrow();
  });

  it('rejects a zilch stake from a player who does not hold the turn', () => {
    let table = createProtocolTable({
      tableId: 'z-turn',
      protocol: ZILCH_PROTOCOL,
      playerIds: [P1, P2],
    });
    table = applyAction(table, P1, 'start-turn');
    expect(codeOf(() => assertActionAllowed(table, P2, 'stake'))).toBe('TURN_ORDER');
    expect(() => assertActionAllowed(table, P1, 'stake')).not.toThrow();
  });

  it('does not enforce turn between blackjack players, but tracks the active box', () => {
    let table = createProtocolTable({
      tableId: 'bj-box',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    table = applyAction(table, BANK, 'open-betting');
    expect(() => applyAction(table, P2, 'bet')).not.toThrow();
    table = applyAction(table, P2, 'bet');
    expect(table.activeSeatUserId).toBe(P2);
    table = applyAction(table, P1, 'bet');
    expect(table.activeSeatUserId).toBe(P1);
  });
});

describe('rotating authority', () => {
  it('rotates the poker dealer on new-hand', () => {
    let table = createProtocolTable({
      tableId: 'pk-rot',
      protocol: POKER_PROTOCOL,
      playerIds: [P1, P2, P3],
    });
    expect(getAuthorityUserId(table)).toBe(P1);
    table = applyAction(table, P1, 'start-hand');
    table = applyAction(table, P1, 'begin-betting');
    table = applyAction(table, P1, 'begin-showdown');
    table = applyAction(table, P1, 'finish-showdown');
    table = applyAction(table, P1, 'new-hand');
    expect(getAuthorityUserId(table)).toBe(P2);
    expect(getCurrentTurnUserId(table)).toBe(P3);
  });

  it('rotates the zilch turn-holder on next-turn', () => {
    let table = createProtocolTable({
      tableId: 'z-rot',
      protocol: ZILCH_PROTOCOL,
      playerIds: [P1, P2, P3],
    });
    table = applyAction(table, P1, 'start-turn');
    table = applyAction(table, P1, 'begin-resolution');
    table = applyAction(table, P1, 'next-turn');
    expect(getAuthorityUserId(table)).toBe(P2);
    expect(getCurrentTurnUserId(table)).toBe(P2);
  });

  it('rotates the blackjack bank on reopen-betting only in rotating mode', () => {
    let standing = createProtocolTable({
      tableId: 'bj-stand',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    standing = toNewRound(standing, BANK);
    standing = applyAction(standing, BANK, 'reopen-betting');
    expect(getAuthorityUserId(standing)).toBe(BANK);

    let rotating = createProtocolTable({
      tableId: 'bj-rot',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2, P3],
      authorityMode: 'rotating',
    });
    expect(getAuthorityUserId(rotating)).toBe(P1);
    rotating = toNewRound(rotating, P1);
    rotating = applyAction(rotating, P1, 'reopen-betting');
    expect(getAuthorityUserId(rotating)).toBe(P2);
  });
});

describe('canResolve wired to escrow', () => {
  it('authorizes the standing bank and rejects others, including after a new round', () => {
    let table = createProtocolTable({
      tableId: 'bj-auth',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    expect(canResolveForTable(table)(BANK, BLACKJACK_PROTOCOL)).toBe(true);
    expect(canResolveForTable(table)(P1, BLACKJACK_PROTOCOL)).toBe(false);
    table = toNewRound(table, BANK);
    table = applyAction(table, BANK, 'reopen-betting');
    expect(canResolveForTable(table)(BANK, BLACKJACK_PROTOCOL)).toBe(true);
    expect(canResolveForTable(table)(P1, BLACKJACK_PROTOCOL)).toBe(false);
  });

  it('authorizes the current rotating dealer and rejects the previous one after new-hand', () => {
    let table = createProtocolTable({
      tableId: 'pk-auth',
      protocol: POKER_PROTOCOL,
      playerIds: [P1, P2, P3],
    });
    expect(canResolveForTable(table)(P1, POKER_PROTOCOL)).toBe(true);
    table = applyAction(table, P1, 'start-hand');
    table = applyAction(table, P1, 'begin-betting');
    table = applyAction(table, P1, 'begin-showdown');
    table = applyAction(table, P1, 'finish-showdown');
    table = applyAction(table, P1, 'new-hand');
    expect(canResolveForTable(table)(P1, POKER_PROTOCOL)).toBe(false);
    expect(canResolveForTable(table)(P2, POKER_PROTOCOL)).toBe(true);
  });

  it('is the canResolve callback EscrowService uses for resolve and release', async () => {
    const escrow = createEscrowService();
    await escrow.ensureMasterWallet(P1, 100);
    await escrow.ensureMasterWallet(P2, 100);
    await escrow.buyIn({ userId: P1, tableId: 'wired', amount: 40, actorId: P1 });
    await escrow.buyIn({ userId: P2, tableId: 'wired', amount: 40, actorId: P2 });
    const confirmed = await escrow.confirm({ userId: P1, tableId: 'wired', amount: 10, actorId: P1 });
    const locked = await escrow.lock({
      escrowId: confirmed.id,
      actorId: P1,
    });

    const table = createProtocolTable({
      tableId: 'wired',
      protocol: POKER_PROTOCOL,
      playerIds: [P1, P2],
    });
    await expect(
      escrow.resolve({
        escrowId: locked.id,
        actorId: P2,
        protocolConfig: POKER_PROTOCOL,
        canResolve: canResolveForTable(table),
        winners: [P1],
      }),
    ).rejects.toThrow(/not allowed/);

    const resolved = await escrow.resolve({
      escrowId: locked.id,
      actorId: P1,
      protocolConfig: POKER_PROTOCOL,
      canResolve: canResolveForTable(table),
      winners: [P1],
    });
    await escrow.release({
      escrowId: resolved.id,
      actorId: P1,
      protocolConfig: POKER_PROTOCOL,
      canResolve: canResolveForTable(table),
    });
    expect((await escrow.getEscrow(resolved.id))?.state).toBe('RELEASED');
  });
});

describe('blackjack box ownership', () => {
  it('lets a seated player act only on their own box, not another seated player\'s', () => {
    let table = createProtocolTable({
      tableId: 'bj-own',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    table = applyAction(table, BANK, 'open-betting');
    table = applyAction(table, P1, 'bet', { amount: 10 });
    table = applyAction(table, P2, 'bet', { amount: 10 });
    expect(table.boxes).toHaveLength(2);
    const p1Box = table.boxes.find((box) => box.ownerUserId === P1)!;
    const p2Box = table.boxes.find((box) => box.ownerUserId === P2)!;
    expect(p1Box.stake).toBe(10);
    expect(p2Box.ownerUserId).toBe(P2);
    expect(codeOf(() => applyAction(table, P2, 'bet', { boxId: p1Box.id, amount: 5 }))).toBe(
      'BOX_OWNERSHIP',
    );

    table = applyAction(table, BANK, 'close-betting');
    expect(table.boxes.every((box) => box.status === 'locked')).toBe(true);
    table = applyAction(table, BANK, 'signal-cards-dealt');

    expect(codeOf(() => assertActionAllowed(table, P1, 'double', { boxId: p2Box.id }))).toBe('BOX_OWNERSHIP');
    expect(codeOf(() => applyAction(table, P1, 'split', { boxId: p2Box.id }))).toBe('BOX_OWNERSHIP');
    expect(codeOf(() => applyAction(table, P2, 'bet', { boxId: p1Box.id }))).toBe('ACTION_PHASE');

    table = applyAction(table, BANK, 'open-insurance-window');
    expect(codeOf(() => applyAction(table, P2, 'insurance', { boxId: p1Box.id, amount: 5 }))).toBe(
      'BOX_OWNERSHIP',
    );

    expect(() => applyAction(table, P1, 'double', { boxId: p1Box.id, amount: 10 })).not.toThrow();
    const after = applyAction(table, P1, 'split', { boxId: p1Box.id });
    expect(after.boxes.filter((box) => box.ownerUserId === P1)).toHaveLength(2);
    expect(after.boxes.filter((box) => box.ownerUserId === P2)).toHaveLength(1);
  });

  it('still requires the actor to be seated, in addition to owning the box', () => {
    let table = createProtocolTable({
      tableId: 'bj-seat',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      standingAuthorityUserId: BANK,
    });
    table = applyAction(table, BANK, 'open-betting');
    table = applyAction(table, P1, 'bet', { amount: 5 });
    const box = table.boxes[0]!;
    expect(codeOf(() => assertActionAllowed(table, 'stranger', 'bet', { boxId: box.id }))).toBe(
      'UNAUTHORIZED',
    );
  });
});

describe('setup bank assignment', () => {
  it('lets the table owner assign standing bank, one at a time', () => {
    let table = createProtocolTable({
      tableId: 'bj-assign',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1, P2],
      tableOwnerUserId: P1,
      standingAuthorityUserId: null,
    });
    expect(codeOf(() => applyAction(table, P2, 'assign-bank', { targetUserId: P2 }))).toBe('UNAUTHORIZED');
    table = applyAction(table, P1, 'assign-bank', { targetUserId: P2 });
    expect(getAuthorityUserId(table)).toBe(P2);
    table = applyAction(table, P1, 'assign-bank', { targetUserId: P1 });
    expect(getAuthorityUserId(table)).toBe(P1);
  });

  it('hides start-betting until Bank is set and another player has joined', () => {
    let table = createProtocolTable({
      tableId: 'bj-start',
      protocol: BLACKJACK_PROTOCOL,
      playerIds: [P1],
      tableOwnerUserId: P1,
      standingAuthorityUserId: null,
    });
    expect(codeOf(() => applyAction(table, P1, 'open-betting'))).toBe('UNAUTHORIZED');
    table = applyAction(table, P1, 'assign-bank', { targetUserId: P1 });
    expect(codeOf(() => applyAction(table, P1, 'open-betting'))).toBe('PLAYERS_REQUIRED');
    table = { ...table, playerIds: [P1, P2] };
    expect(() => applyAction(table, P1, 'open-betting')).not.toThrow();
    expect(codeOf(() => applyAction(table, P2, 'open-betting'))).toBe('UNAUTHORIZED');
  });
});

function toNewRound(table: ReturnType<typeof createProtocolTable>, bankId: string) {
  let next = applyAction(table, bankId, 'open-betting');
  next = applyAction(next, bankId, 'close-betting');
  next = applyAction(next, bankId, 'signal-cards-dealt');
  next = applyAction(next, bankId, 'begin-resolution');
  return applyAction(next, bankId, 'finish-resolution');
}
