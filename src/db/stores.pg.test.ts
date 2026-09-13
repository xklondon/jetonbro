import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import request from 'supertest';
import { createPersistentApp } from '../http/app.js';
import { defineEscrowServiceTests } from '../escrow/service.contract.js';
import { createProtocolTable, getProtocol } from '../protocol/index.js';
import { createPersonalLedger } from '../ledger/service.js';
import { connectTestDatabase, pgStores, testDatabaseUrl, truncateAll } from './pg-test.js';
import { runMigrations } from './migrate.js';

const url = testDatabaseUrl();
const describePg = url ? describe : describe.skip;

describePg('Postgres stores', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await connectTestDatabase();
  });

  beforeEach(async () => {
    await truncateAll(pool);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('runs ordered migrations once, then no-ops', async () => {
    const first = await runMigrations(pool);
    const second = await runMigrations(pool);
    expect(first.length === 0 || first.includes('001_init.sql')).toBe(true);
    expect(second).toEqual([]);
    const applied = await pool.query('SELECT id FROM schema_migrations ORDER BY id');
    expect(applied.rows.map((row) => row.id)).toContain('001_init.sql');
  });

  defineEscrowServiceTests('postgres', () => pgStores(pool).escrow);

  it('PersonalLedgerStore clones and shares rows across service instances', async () => {
    const store = pgStores(pool).ledgerStore;
    const a = createPersonalLedger(store);
    const b = createPersonalLedger(store);
    await a.recordRelease(
      {
        id: 'escrow-1',
        tableId: 't',
        userId: 'alice',
        amount: 10,
        state: 'RELEASED',
        payout: {
          rule: 'multiplier',
          outcome: 'lose',
          credits: [{ userId: 'bob', amount: 10 }],
          counterpartyUserId: 'bob',
        },
      },
      '2026-09-13T00:00:00.000Z',
    );
    expect(await b.standing('alice', 'bob')).toEqual({ status: 'owes', owes: 'alice', amount: 10 });
    await a.clear('alice', 'bob', 'alice');
    expect(await b.standing('alice', 'bob')).toEqual({ status: 'settled' });
    const snap = await a.save('alice', 'bob');
    expect((await b.listSnapshots('alice'))[0]?.id).toBe(snap.id);
  });

  it('TableRuntimeStore put/get clones and ensureRuntime loads a stored phase', async () => {
    const { runtimeStore: runtime, auth, tables } = pgStores(pool);
    const protocol = createProtocolTable({
      tableId: 't1',
      protocol: getProtocol('blackjack'),
      playerIds: ['owner'],
      tableOwnerUserId: 'owner',
      standingAuthorityUserId: 'bank',
    });
    protocol.phase = 'betting';
    await runtime.put({ tableId: 't1', protocol, boxEscrowIds: { box1: ['escrow-1'] } });
    protocol.phase = 'setup';
    const loaded = await runtime.get('t1');
    expect(loaded?.protocol.phase).toBe('betting');
    loaded!.boxEscrowIds.box1?.push('mutated');
    expect((await runtime.get('t1'))?.boxEscrowIds.box1).toEqual(['escrow-1']);

    const issued = await auth.requestMagicLink({ email: 'host@t.test' });
    const session = await auth.verify({ token: issued.token });
    const table = await auth.createTable(session.sessionToken, { protocolId: 'blackjack' });
    await tables.snapshot(session.sessionToken, table.id);
    const bankInvite = await auth.createInvite(session.sessionToken, table.id, {
      channel: 'email',
      email: 'bank@t.test',
      openingChips: 20,
    });
    const bank = await auth.verify({ token: bankInvite.magicToken ?? '' });
    await tables.act(session.sessionToken, table.id, { actionId: 'assign-bank', targetUserId: bank.user.id });
    await tables.act(bank.sessionToken, table.id, { actionId: 'open-betting' });

    const second = pgStores(pool).tables;
    const view = await second.snapshot(session.sessionToken, table.id);
    expect(view.phase).toBe('betting-open');
    expect(view.authorityUserId).toBe(bank.user.id);
    expect(JSON.stringify(await runtime.get(table.id))).not.toContain('data:image');
  });

  it('AuthStore persists users, sessions, invites, and memberships', async () => {
    const { auth } = pgStores(pool);
    const issued = await auth.requestMagicLink({ email: 'ada@t.test' });
    const session = await auth.verify({ token: issued.token });
    const table = await auth.createTable(session.sessionToken, { protocolId: 'blackjack' });
    const invite = await auth.createInvite(session.sessionToken, table.id, {
      channel: 'email',
      email: 'guest@t.test',
      openingChips: 15,
    });
    const guest = await auth.verify({ token: invite.magicToken ?? '' });
    const me = await auth.me(guest.sessionToken);
    expect(me.user.email).toBe('guest@t.test');
    expect(me.tableIds).toEqual([table.id]);
    expect(me.wallet?.balance).toBe(0);

    const again = pgStores(pool).auth;
    const still = await again.me(guest.sessionToken);
    expect(still.user.id).toBe(guest.user.id);
    expect(still.tableIds).toEqual([table.id]);
    await expect(again.inspectMagicLink(issued.token)).rejects.toThrow(/invalid or already used/);
  });

  it('createPersistentApp serves the same invite flow as memory', async () => {
    const { app, pool: appPool } = await createPersistentApp(url!);
    try {
      const agent = request(app);
      const link = await agent.post('/api/auth/request-magic-link').send({ email: 'owner@t.test' }).expect(201);
      const session = await agent.post('/api/auth/verify').send({ token: link.body.token }).expect(200);
      const table = await agent
        .post('/api/tables')
        .set('Authorization', `Bearer ${session.body.sessionToken}`)
        .expect(201);
      const invite = await agent
        .post(`/api/tables/${table.body.id}/invites`)
        .set('Authorization', `Bearer ${session.body.sessionToken}`)
        .send({ channel: 'email', email: 'p@t.test', openingChips: 25 })
        .expect(201);
      await agent.post('/api/auth/verify').send({ token: invite.body.magicToken }).expect(200);
      const snap = await agent
        .get(`/api/tables/${table.body.id}`)
        .set('Authorization', `Bearer ${session.body.sessionToken}`)
        .expect(200);
      expect(snap.body.invites[0].status).toBe('joined');
      expect(snap.body.players.some((row: { stack: number }) => row.stack === 25)).toBe(true);
    } finally {
      await appPool?.end();
    }
  });
});
