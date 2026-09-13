import { describe, expect, it, vi } from 'vitest';
import { createEscrowService } from '../escrow/service.js';
import { createMemoryStore } from '../escrow/store.js';
import { createApp } from '../http/app.js';
import request from 'supertest';
import { createResendMailer, DEFAULT_RESEND_FROM, mailerFromEnv, RESEND_EMAILS_URL } from './mailer.js';
import { createAuthService } from './service.js';

delete process.env.RESEND_API_KEY;

function escrow() {
  return createEscrowService(createMemoryStore());
}

describe('Resend magic-link mailer', () => {
  it('mailerFromEnv is null when no API key is set', () => {
    expect(mailerFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
    expect(mailerFromEnv({ RESEND_API_KEY: '  ' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('POSTs the frontend verify URL to Resend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    const mailer = createResendMailer({
      apiKey: 're_test',
      from: 'JetonBro <table@example.test>',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await mailer.send({
      to: 'ada@t.test',
      verifyPageUrl: 'https://app.test/verify?token=abc-123',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer re_test',
      'content-type': 'application/json',
    });
    const body = JSON.parse(String(init.body));
    expect(body.from).toBe('JetonBro <table@example.test>');
    expect(body.to).toEqual(['ada@t.test']);
    expect(body.html).toContain('https://app.test/verify?token=abc-123');
    expect(body.html).not.toContain('/api/auth/verify');
  });

  it('defaults the Resend test sender when from is omitted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    const mailer = mailerFromEnv(
      { RESEND_API_KEY: 're_env' } as NodeJS.ProcessEnv,
      fetchImpl as unknown as typeof fetch,
    );
    expect(mailer).toBeTruthy();
    await mailer!.send({ to: 'ada@t.test', verifyPageUrl: 'https://app.test/verify?token=x' });
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.from).toBe(DEFAULT_RESEND_FROM);
  });

  it('without a mailer, requestMagicLink only writes the outbox and returns the token', async () => {
    const auth = createAuthService(escrow());
    const issued = await auth.requestMagicLink({ email: 'dev@t.test' });
    expect(issued.emailed).toBe(false);
    expect(issued.token).toBeTruthy();
    expect(auth.emailOutbox).toEqual([
      expect.objectContaining({ to: 'dev@t.test', magicToken: issued.token, verifyUrl: issued.verifyUrl }),
    ]);
  });

  it('with a mailer, email-channel sends the page verify URL and HTTP hides the token', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const auth = createAuthService(escrow(), undefined, {
      mailer: { send },
      appOrigin: 'https://app.test',
    });
    const { app } = createApp({ auth });
    const agent = request(app);

    const home = await agent.post('/api/auth/request-magic-link').send({ email: 'host@t.test' }).expect(201);
    expect(home.body).toEqual({ emailed: true });
    expect(home.body.token).toBeUndefined();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({
      to: 'host@t.test',
      verifyPageUrl: expect.stringMatching(/^https:\/\/app\.test\/verify\?token=/),
    });

    const token = auth.emailOutbox[0]?.magicToken ?? '';
    const peeked = await agent.get('/api/auth/verify').query({ token }).expect(200);
    expect(peeked.body.email).toBe('host@t.test');
    expect(peeked.body.sessionToken).toBeUndefined();
    expect(peeked.body.user).toBeUndefined();

    const session = await agent.post('/api/auth/verify').send({ token }).expect(200);
    expect(session.body.user.email).toBe('host@t.test');

    const table = await agent
      .post('/api/tables')
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .expect(201);

    send.mockClear();
    const emailInvite = await agent
      .post(`/api/tables/${table.body.id}/invites`)
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .send({ channel: 'email', email: 'guest@t.test' })
      .expect(201);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({
      to: 'guest@t.test',
      verifyPageUrl: `https://app.test${emailInvite.body.joinPath}`,
    });

    send.mockClear();
    await agent
      .post(`/api/tables/${table.body.id}/invites`)
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .send({ channel: 'whatsapp', email: 'wa@t.test' })
      .expect(201);
    expect(send).not.toHaveBeenCalled();

    await agent
      .post(`/api/tables/${table.body.id}/invites`)
      .set('Authorization', `Bearer ${session.body.sessionToken}`)
      .send({ channel: 'qr' })
      .expect(201);
    expect(send).not.toHaveBeenCalled();
  });
});
