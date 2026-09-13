import { describe, expect, it } from 'vitest';
import { createAuthService } from '../auth/service.js';
import { createEscrowService, createMemoryStore } from '../escrow/index.js';
import { createPersonalLedger, listenForReleases } from '../ledger/index.js';
import { createProtocolTable, getProtocol } from '../protocol/index.js';
import { createTableService } from './service.js';
import { createMemoryTableRuntimeStore } from './store.js';

describe('TableRuntimeStore', () => {
  it('clones on put so later mutation of the argument does not change the store', async () => {
    const store = createMemoryTableRuntimeStore();
    const protocol = createProtocolTable({
      tableId: 't1',
      protocol: getProtocol('blackjack'),
      playerIds: ['owner'],
      tableOwnerUserId: 'owner',
      standingAuthorityUserId: 'bank',
    });
    protocol.phase = 'betting';
    await store.put({ tableId: 't1', protocol, boxEscrowIds: { box1: ['escrow-1'] } });
    protocol.phase = 'setup';
    const loaded = await store.get('t1');
    expect(loaded?.protocol.phase).toBe('betting');
    expect(loaded?.protocol.standingAuthorityUserId).toBe('bank');
    expect(loaded?.boxEscrowIds.box1).toEqual(['escrow-1']);
    loaded!.boxEscrowIds.box1?.push('mutated');
    expect((await store.get('t1'))?.boxEscrowIds.box1).toEqual(['escrow-1']);
  });

  it('ensureRuntime loads a stored phase instead of fabricating setup', async () => {
    const runtimeStore = createMemoryTableRuntimeStore();
    const ledger = createPersonalLedger();
    const escrow = createEscrowService(listenForReleases(createMemoryStore(), ledger));
    const auth = createAuthService(escrow);
    const first = createTableService(escrow, auth, ledger, runtimeStore);

    const issued = await auth.requestMagicLink({ email: 'host@t.test' });
    const session = await auth.verify({ token: issued.token });
    const table = await auth.createTable(session.sessionToken, { protocolId: 'blackjack' });

    await first.snapshot(session.sessionToken, table.id);
    const bankInvite = await auth.createInvite(session.sessionToken, table.id, {
      channel: 'email',
      email: 'bank@t.test',
      openingChips: 20,
    });
    const bank = await auth.verify({ token: bankInvite.magicToken ?? '' });
    await first.act(session.sessionToken, table.id, { actionId: 'assign-bank', targetUserId: bank.user.id });
    await first.act(bank.sessionToken, table.id, { actionId: 'open-betting' });

    const stored = await runtimeStore.get(table.id);
    expect(stored?.protocol.phase).toBe('betting-open');
    expect(stored?.protocol.standingAuthorityUserId).toBe(bank.user.id);

    const second = createTableService(escrow, auth, ledger, runtimeStore);
    const view = await second.snapshot(session.sessionToken, table.id);
    expect(view.phase).toBe('betting-open');
    expect(view.authorityUserId).toBe(bank.user.id);
    expect(view.viewer.handDisplay).toEqual({ userId: session.user.id, text: '', photo: '' });
  });

  it('does not persist hand photos on the runtime store', async () => {
    const runtimeStore = createMemoryTableRuntimeStore();
    const ledger = createPersonalLedger();
    const escrow = createEscrowService(listenForReleases(createMemoryStore(), ledger));
    const auth = createAuthService(escrow);
    const tables = createTableService(escrow, auth, ledger, runtimeStore);
    const issued = await auth.requestMagicLink({ email: 'photo@t.test' });
    const session = await auth.verify({ token: issued.token });
    const table = await auth.createTable(session.sessionToken, { protocolId: 'blackjack' });
    await tables.setHandDisplay(session.sessionToken, table.id, { text: 'A♥', photo: 'data:image/png;base64,aaa' });
    const stored = await runtimeStore.get(table.id);
    expect(JSON.stringify(stored)).not.toContain('data:image');
    expect(JSON.stringify(stored)).not.toContain('A♥');
    const shown = await tables.snapshot(session.sessionToken, table.id);
    expect(shown.viewer.handDisplay.text).toBe('A♥');
    expect(shown.viewer.handDisplay.photo).toBe('data:image/png;base64,aaa');
  });
});
