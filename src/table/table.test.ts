import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../http/app.js';

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

describe('table play + standings', () => {
  it('rejects a seated player acting on another player\'s blackjack box', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'bank@t.test');
    const table = await agent
      .post('/api/tables')
      .set(auth(owner.token))
      .send({ protocolId: 'blackjack' })
      .expect(201);
    const tableId = table.body.id as string;

    const invite = await agent
      .post(`/api/tables/${tableId}/invites`)
      .set(auth(owner.token))
      .send({ channel: 'email', email: 'p2@t.test' })
      .expect(201);
    const p2 = await agent
      .post('/api/auth/verify')
      .send({ token: invite.body.magicToken, acceptedTerms: true })
      .expect(200);
    const p2Token = p2.body.sessionToken as string;
    const p2Id = p2.body.user.id as string;

    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-chips', amount: 50, targetUserId: owner.userId })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'assign-chips', amount: 50, targetUserId: p2Id })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'open-betting' })
      .expect(200);

    const afterP1 = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'bet', amount: 10 })
      .expect(200);
    const p1Box = afterP1.body.boxes.find((box: { ownerUserId: string }) => box.ownerUserId === owner.userId);
    expect(p1Box).toBeTruthy();
    expect(afterP1.body.pot.amount).toBe(10);
    expect(afterP1.body.viewer.stack).toBe(40);

    const afterP2 = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p2Token))
      .send({ actionId: 'bet', amount: 10 })
      .expect(200);
    expect(afterP2.body.boxes).toHaveLength(2);
    expect(afterP2.body.pot.amount).toBe(20);

    const denied = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p2Token))
      .send({ actionId: 'bet', amount: 5, boxId: p1Box.id })
      .expect(400);
    expect(denied.body.error).toBe('BOX_OWNERSHIP');

    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'close-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'signal-cards-dealt' })
      .expect(200);

    const steal = await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(p2Token))
      .send({ actionId: 'double', amount: 10, boxId: p1Box.id })
      .expect(400);
    expect(steal.body.error).toBe('BOX_OWNERSHIP');
  });

  it('stores hand display as opaque text/photo and never scores it', async () => {
    const { app } = createApp();
    const agent = request(app);
    const owner = await signIn(agent, 'hand@t.test');
    const table = await agent.post('/api/tables').set(auth(owner.token)).send({ protocolId: 'blackjack' }).expect(201);
    const tableId = table.body.id as string;
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'open-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'close-betting' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
      .send({ actionId: 'signal-cards-dealt' })
      .expect(200);
    await agent
      .post(`/api/tables/${tableId}/actions`)
      .set(auth(owner.token))
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
});
