import request, { type Agent } from 'supertest';
import { describe, expect, it } from 'vitest';
import { guestUserId } from './service.js';
import { createApp } from '../http/app.js';
import type { EscrowService } from '../escrow/service.js';

async function ownerWithTable() {
  const { app, escrow } = createApp();
  const agent = request(app);
  const link = await agent.post('/api/auth/request-magic-link').send({ email: 'owner@t.test' }).expect(201);
  const session = await agent
    .post('/api/auth/verify')
    .send({ token: link.body.token, acceptedTerms: true })
    .expect(200);
  const table = await agent
    .post('/api/tables')
    .set('Authorization', `Bearer ${session.body.sessionToken}`)
    .expect(201);
  return {
    agent,
    escrow,
    ownerToken: session.body.sessionToken as string,
    ownerId: session.body.user.id as string,
    tableId: table.body.id as string,
  };
}

async function createInvite(
  agent: Agent,
  ownerToken: string,
  tableId: string,
  body: { channel: string; email?: string; phone?: string },
) {
  const res = await agent
    .post(`/api/tables/${tableId}/invites`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .send(body)
    .expect(201);
  return res.body as {
    token: string;
    channel: string;
    shareUrl: string | null;
    magicToken: string | null;
    verifyUrl: string | null;
    previewUrl: string;
  };
}

function masterWalletsFor(escrow: EscrowService, userId: string) {
  return escrow.listMasterWallets().filter((wallet) => wallet.userId === userId);
}

describe('invite / identity paths', () => {
  it('email invite: magic-link + T&Cs creates one wallet and joins the table', async () => {
    const { agent, escrow, ownerToken, ownerId, tableId } = await ownerWithTable();
    const invite = await createInvite(agent, ownerToken, tableId, {
      channel: 'email',
      email: 'ada@t.test',
    });
    expect(invite.magicToken).toBeTruthy();
    expect(invite.shareUrl).toBeNull();

    const session = await agent
      .post('/api/auth/verify')
      .send({ token: invite.magicToken, acceptedTerms: true })
      .expect(200);

    expect(session.body.user.email).toBe('ada@t.test');
    expect(session.body.user.isGuest).toBe(false);
    expect(session.body.user.acceptedTermsAt).toBeTruthy();

    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .expect(200);
    expect(me.body.tableIds).toEqual([tableId]);
    expect(me.body.wallet.id).toBeTruthy();

    expect(masterWalletsFor(escrow, session.body.user.id)).toHaveLength(1);
    expect(escrow.listMasterWallets()).toHaveLength(2);
    expect(masterWalletsFor(escrow, ownerId)).toHaveLength(1);
  });

  it('WhatsApp invite uses the same magic-link/verify path via a share intent', async () => {
    const { agent, escrow, ownerToken, tableId } = await ownerWithTable();
    const invite = await createInvite(agent, ownerToken, tableId, {
      channel: 'whatsapp',
      email: 'wa@t.test',
    });
    expect(invite.shareUrl).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(invite.shareUrl).toContain(encodeURIComponent(invite.verifyUrl ?? ''));
    expect(invite.magicToken).toBeTruthy();

    const denied = await agent.post('/api/auth/verify').send({ token: invite.magicToken }).expect(400);
    expect(denied.body.error).toBe('TERMS_REQUIRED');

    const session = await agent
      .post('/api/auth/verify')
      .send({ token: invite.magicToken, acceptedTerms: true })
      .expect(200);

    expect(session.body.user.email).toBe('wa@t.test');
    expect(masterWalletsFor(escrow, session.body.user.id)).toHaveLength(1);
    expect(escrow.listMasterWallets()).toHaveLength(2);
  });

  it('QR (non-mates): contact capture then the same magic-link flow', async () => {
    const { agent, escrow, ownerToken, tableId } = await ownerWithTable();
    const invite = await createInvite(agent, ownerToken, tableId, { channel: 'qr' });
    expect(invite.magicToken).toBeNull();

    const preview = await agent.get('/api/invites/preview').query({ token: invite.token }).expect(200);
    expect(preview.body.requiresContact).toBe(true);
    expect(preview.body.requiresTerms).toBe(true);

    const link = await agent
      .post('/api/auth/request-magic-link')
      .send({ phone: '+44 7700 900123', inviteToken: invite.token })
      .expect(201);

    const session = await agent
      .post('/api/auth/verify')
      .send({ token: link.body.token, acceptedTerms: true })
      .expect(200);

    expect(session.body.user.phone).toBe('+447700900123');
    expect(session.body.user.acceptedTermsAt).toBeTruthy();
    expect(masterWalletsFor(escrow, session.body.user.id)).toHaveLength(1);
    expect(escrow.listMasterWallets()).toHaveLength(2);
  });

  it('Mates-mode guest joins immediately with a device-scoped wallet and no T&Cs', async () => {
    const { agent, escrow, ownerToken, tableId } = await ownerWithTable();
    const invite = await createInvite(agent, ownerToken, tableId, { channel: 'mates' });

    const preview = await agent.get('/api/invites/preview').query({ token: invite.token }).expect(200);
    expect(preview.body.requiresContact).toBe(false);
    expect(preview.body.requiresTerms).toBe(false);

    const session = await agent
      .post('/api/invites/mates/join')
      .send({ token: invite.token, deviceId: 'device-mates-1' })
      .expect(201);

    expect(session.body.user.id).toBe(guestUserId('device-mates-1'));
    expect(session.body.user.isGuest).toBe(true);
    expect(session.body.user.acceptedTermsAt).toBeNull();
    expect(session.body.user.email).toBeNull();

    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .expect(200);
    expect(me.body.tableIds).toEqual([tableId]);
    expect(me.body.wallet.userId).toBe(guestUserId('device-mates-1'));

    expect(masterWalletsFor(escrow, guestUserId('device-mates-1'))).toHaveLength(1);
    expect(escrow.listMasterWallets()).toHaveLength(2);
  });

  it('guest upgrade re-owns the existing wallet instead of creating a second one', async () => {
    const { agent, escrow, ownerToken, tableId } = await ownerWithTable();
    const invite = await createInvite(agent, ownerToken, tableId, { channel: 'mates' });
    const guest = await agent
      .post('/api/invites/mates/join')
      .send({ token: invite.token, deviceId: 'device-upgrade' })
      .expect(201);

    const guestId = guest.body.user.id as string;
    const original = escrow.getMasterWallet(guestId);
    expect(original).toBeDefined();

    const link = await agent
      .post('/api/auth/request-magic-link')
      .send({ email: 'upgraded@t.test', deviceId: 'device-upgrade' })
      .expect(201);

    const denied = await agent.post('/api/auth/verify').send({ token: link.body.token }).expect(400);
    expect(denied.body.error).toBe('TERMS_REQUIRED');
    expect(escrow.getMasterWallet(guestId)?.id).toBe(original!.id);

    const stillGuestLink = await agent
      .post('/api/auth/request-magic-link')
      .send({ email: 'upgraded@t.test', deviceId: 'device-upgrade' })
      .expect(201);

    const upgraded = await agent
      .post('/api/auth/verify')
      .send({ token: stillGuestLink.body.token, acceptedTerms: true })
      .expect(200);

    expect(upgraded.body.user.id).not.toBe(guestId);
    expect(upgraded.body.user.email).toBe('upgraded@t.test');
    expect(upgraded.body.user.isGuest).toBe(false);
    expect(upgraded.body.user.upgradedFromUserId).toBe(guestId);
    expect(upgraded.body.user.acceptedTermsAt).toBeTruthy();

    expect(escrow.getMasterWallet(guestId)).toBeUndefined();
    const moved = escrow.getMasterWallet(upgraded.body.user.id);
    expect(moved?.id).toBe(original!.id);
    expect(moved?.userId).toBe(upgraded.body.user.id);
    expect(escrow.listMasterWallets()).toHaveLength(2);
    expect(masterWalletsFor(escrow, upgraded.body.user.id)).toHaveLength(1);

    const me = await agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${upgraded.body.sessionToken}`)
      .expect(200);
    expect(me.body.wallet.id).toBe(original!.id);
    expect(me.body.tableIds).toEqual([tableId]);
  });

  it('T&Cs are required on the three non-mates paths and skipped on Mates mode', async () => {
    const { agent, ownerToken, tableId } = await ownerWithTable();

    const emailInvite = await createInvite(agent, ownerToken, tableId, {
      channel: 'email',
      email: 'terms-email@t.test',
    });
    const emailDenied = await agent.post('/api/auth/verify').send({ token: emailInvite.magicToken }).expect(400);
    expect(emailDenied.body.error).toBe('TERMS_REQUIRED');

    const qrInvite = await createInvite(agent, ownerToken, tableId, { channel: 'qr' });
    const qrLink = await agent
      .post('/api/auth/request-magic-link')
      .send({ email: 'terms-qr@t.test', inviteToken: qrInvite.token })
      .expect(201);
    const qrDenied = await agent.post('/api/auth/verify').send({ token: qrLink.body.token }).expect(400);
    expect(qrDenied.body.error).toBe('TERMS_REQUIRED');

    const waInvite = await createInvite(agent, ownerToken, tableId, {
      channel: 'whatsapp',
      phone: '07700900456',
    });
    const waDenied = await agent.post('/api/auth/verify').send({ token: waInvite.magicToken }).expect(400);
    expect(waDenied.body.error).toBe('TERMS_REQUIRED');

    const matesInvite = await createInvite(agent, ownerToken, tableId, { channel: 'mates' });
    const mates = await agent
      .post('/api/invites/mates/join')
      .send({ token: matesInvite.token, deviceId: 'device-terms' })
      .expect(201);
    expect(mates.body.user.acceptedTermsAt).toBeNull();
    expect(mates.body.user.isGuest).toBe(true);
  });

  it('a bare GET on the verify link never creates an account or wallet', async () => {
    const { agent, escrow } = await ownerWithTable();
    const before = escrow.listMasterWallets().length;
    const link = await agent.post('/api/auth/request-magic-link').send({ email: 'scanner@t.test' }).expect(201);

    const peeked = await agent
      .get('/api/auth/verify')
      .query({ token: link.body.token, acceptedTerms: '1' })
      .expect(200);

    expect(peeked.body.requiresTerms).toBe(true);
    expect(peeked.body.email).toBe('scanner@t.test');
    expect(peeked.body.sessionToken).toBeUndefined();
    expect(peeked.body.user).toBeUndefined();
    expect(escrow.listMasterWallets()).toHaveLength(before);
    expect(escrow.getMasterWallet).toBeDefined();
    expect(escrow.listMasterWallets().some((wallet) => wallet.userId.includes('scanner'))).toBe(false);

    const again = await agent.get('/api/auth/verify').query({ token: link.body.token }).expect(200);
    expect(again.body.requiresTerms).toBe(true);

    const created = await agent
      .post('/api/auth/verify')
      .send({ token: link.body.token, acceptedTerms: true })
      .expect(200);
    expect(created.body.user.email).toBe('scanner@t.test');
    expect(escrow.listMasterWallets()).toHaveLength(before + 1);
  });
});
