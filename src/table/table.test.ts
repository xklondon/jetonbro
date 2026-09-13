import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../http/app.js';

delete process.env.RESEND_API_KEY;

async function signIn(agent: ReturnType<typeof request>, email: string) {
  const link = await agent.post('/api/auth/request-magic-link').send({ email }).expect(201);
  const session = await agent
    .post('/api/auth/verify')
    .send({ token: link.body.token, acceptedTerms: true })
    .expect(200);
  return {
    token: session.body.sessionToken as string,
    userId: session.body.user.id as string,
  };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function inviteAndJoin(
  agent: ReturnType<typeof request>,
  ownerToken: string,
  tableId: string,
  email: string,
  openingChips: number,
) {
  const invite = await agent
    .post(`/api/tables/${tableId}/invites`)
    .set(auth(ownerToken))
    .send({ channel: 'email', email, openingChips })
    .expect(201);
  const joined = await agent
    .post('/api/auth/verify')
    .send({ token: invite.body.magicToken })
    .expect(200);
  return {
    token: joined.body.sessionToken as string,
    userId: joined.body.user.id as string,
  };
}

describe('table play + standings', () => {
  it('rejects a seated player acting on another player\'s blackjack box', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'host@t.test');
    const table = await agent
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ protocolId: 'blackjack' })
      .expect(201);
    const tableId = table.body.id as string;
    const bank = await inviteAndJoin(agent, owner.token, tableId, 'bank@t.test', 50);
    const p2 = await inviteAndJoin(agent, owner.token, tableId, 'p2@t.test', 50);
    const p3 = await inviteAndJoin(agent, owner.token, tableId, 'p3@t.test', 50);

    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-bank', targetUserId: bank.userId })
      .expect(200);
    const ownerStart = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'open-betting' })
      .expect(400);
    expect(ownerStart.body.error).toBe('UNAUTHORIZED');
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'open-betting' })
      .expect(200);

    const afterP2 = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p2.token))
      .send({ actionId: 'bet', amount: 10 })
      .expect(200);
    const p2Box = afterP2.body.boxes.find((box: { ownerUserId: string }) => box.ownerUserId === p2.userId);
    expect(p2Box).toBeTruthy();
    expect(afterP2.body.pot.amount).toBe(10);
    expect(afterP2.body.viewer.stack).toBe(40);

    const afterP3 = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p3.token))
      .send({ actionId: 'bet', amount: 10 })
      .expect(200);
    expect(afterP3.body.boxes).toHaveLength(2);
    expect(afterP3.body.pot.amount).toBe(20);

    const denied = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p3.token))
      .send({ actionId: 'bet', amount: 5, boxId: p2Box.id })
      .expect(400);
    expect(denied.body.error).toBe('BOX_OWNERSHIP');

    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'close-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'signal-cards-dealt' })
      .expect(200);

    const steal = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p3.token))
      .send({ actionId: 'double', amount: 10, boxId: p2Box.id })
      .expect(400);
    expect(steal.body.error).toBe('BOX_OWNERSHIP');
  });

  it('stores hand display as opaque text/photo and never scores it', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'hand@t.test');
    const table = await agent.post('/api/tables').set(auth(owner.token)).send({ protocolId: 'blackjack' }).expect(201);
    const tableId = table.body.id as string;
    const bank = await inviteAndJoin(agent, owner.token, tableId, 'hand-bank@t.test', 20);
    await inviteAndJoin(agent, owner.token, tableId, 'hand-p2@t.test', 20);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-bank', targetUserId: bank.userId })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'open-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'close-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'signal-cards-dealt' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'begin-resolution' })
      .expect(200);

    const saved = await agent
      .post(`/api/tables/${tableId}/hand-display`)
      .set(auth(owner.token))
      .send({ text: 'A♥ K♥', photo: 'data:image/png;base64,aaa' })
      .expect(200);
    expect(saved.body.viewer.handDisplay.text).toBe('A♥ K♥');
    expect(saved.body.viewer.handDisplay.photo).toBe('data:image/png;base64,aaa');
  });

  it('wires Standings Save and Clear to the personal ledger', async () => {
    const { app, escrow, ledger } = createApp();
    const agent = request(app);
    const a = await signIn(agent, 'a@t.test');
    const b = await signIn(agent, 'b@t.test');
    escrow.ensureMasterWallet(a.userId, 0);
    escrow.creditGame({ userId: a.userId, tableId: 't1', amount: 30, actorId: a.userId });
    escrow.creditGame({ userId: b.userId, tableId: 't1', amount: 30, actorId: b.userId });
    const locked = escrow.lock({
      escrowId: escrow.confirm({ userId: a.userId, tableId: 't1', amount: 10, actorId: a.userId }).id,
      actorId: a.userId,
    });
    escrow.release({
      escrowId: escrow.resolve({
        escrowId: locked.id,
        actorId: b.userId,
        protocolConfig: { payoutRule: 'even-split' },
        canResolve: () => true,
        winners: [b.userId],
      }).id,
      actorId: b.userId,
      protocolConfig: { payoutRule: 'even-split' },
      canResolve: () => true,
    });

    const standings = await agent.get('/api/standings').set(auth(a.token)).expect(200);
    expect(standings.body.rows).toHaveLength(1);
    expect(standings.body.rows[0].otherUserId).toBe(b.userId);
    expect(standings.body.rows[0].standing.status).toBe('owes');

    await agent.post('/api/standings/save').set(auth(a.token)).send({}).expect(201);
    expect(ledger.listSnapshots(a.userId)).toHaveLength(1);

    await agent.post('/api/standings/clear').set(auth(a.token)).send({ otherUserId: b.userId }).expect(200);
    const after = await agent.get('/api/standings').set(auth(a.token)).expect(200);
    expect(after.body.rows[0].standing.status).toBe('settled');
  });

  it('owner add-player lists pending invites and marks them joined with opening chips', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'host@t.test');
    const table = await agent
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ protocolId: 'blackjack' })
      .expect(201);
    const tableId = table.body.id as string;

    const invite = await agent
      .post(`/api/tables/${tableId}/invites`)
      .set(auth(owner.token))
      .send({ channel: 'email', email: 'guest@t.test', openingChips: 40 })
      .expect(201);
    expect(invite.body.joinPath).toMatch(/^\/verify\?token=/);

    const pending = await agent.get(`/api/tables/${tableId}`).set(auth(owner.token)).expect(200);
    expect(pending.body.invites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'guest@t.test',
          channel: 'email',
          openingChips: 40,
          status: 'pending',
        }),
      ]),
    );

    const guest = await agent.post('/api/auth/verify').send({ token: invite.body.magicToken }).expect(200);
    expect(guest.body.tableId).toBe(tableId);

    const joined = await agent.get(`/api/tables/${tableId}`).set(auth(owner.token)).expect(200);
    const row = joined.body.invites.find((item: { label: string }) => item.label === 'guest@t.test');
    expect(row.status).toBe('joined');
    const player = joined.body.players.find((item: { id: string }) => item.id === guest.body.user.id);
    expect(player.stack).toBe(40);

    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-bank', targetUserId: guest.body.user.id })
      .expect(200);
    const switched = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-bank', targetUserId: owner.userId })
      .expect(200);
    expect(switched.body.authorityUserId).toBe(owner.userId);
    expect(switched.body.viewer.allowedActions.some((action: { id: string }) => action.id === 'open-betting')).toBe(
      true,
    );
  });

  it('lets bank confirm a per-box outcome with an editable suggested payout', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'res-host@t.test');
    const table = await agent
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ protocolId: 'blackjack' })
      .expect(201);
    const tableId = table.body.id as string;
    const bank = await inviteAndJoin(agent, owner.token, tableId, 'res-bank@t.test', 40);
    const player = await inviteAndJoin(agent, owner.token, tableId, 'res-p@t.test', 40);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-bank', targetUserId: bank.userId })
      .expect(200);
    await agent.post(`/api/tables/${tableId}/actions`).set(auth(bank.token)).send({ actionId: 'open-betting' }).expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(player.token))
      .send({ actionId: 'bet', amount: 10 })
      .expect(200);
    await agent.post(`/api/tables/${tableId}/actions`).set(auth(bank.token)).send({ actionId: 'close-betting' }).expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'signal-cards-dealt' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'begin-resolution' })
      .expect(200);

    const board = await agent.get(`/api/tables/${tableId}`).set(auth(bank.token)).expect(200);
    expect(board.body.boxes).toHaveLength(1);
    const boxId = board.body.boxes[0].id as string;

    const released = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(bank.token))
      .send({ actionId: 'declare-outcome', boxId, outcome: 'push', payoutAmount: 10 })
      .expect(200);
    const box = released.body.boxes.find((item: { id: string }) => item.id === boxId);
    expect(box.status).toBe('resolved');
    expect(box.escrowState).toBe('RELEASED');
    const playerRow = released.body.players.find((item: { id: string }) => item.id === player.userId);
    expect(playerRow.stack).toBe(40);
  });
});
