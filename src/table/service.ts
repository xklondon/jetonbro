import type { AuthService } from '../auth/service.js';
import type { EscrowService } from '../escrow/service.js';
import type { Escrow } from '../escrow/types.js';
import type { PersonalLedger } from '../ledger/service.js';
import {
  applyAction,
  assertActionAllowed,
  canResolveForTable,
  createProtocolTable,
  getAction,
  getAuthorityUserId,
  getCurrentTurnUserId,
  getProtocol,
  listAllowedActions,
  peekAuthorityUserId,
} from '../protocol/index.js';
import { fail } from '../auth/errors.js';
import type { ActionInput, Box, ProtocolAction, ProtocolTableState } from '../protocol/types.js';
import {
  boxEscrowIdsFromMap,
  boxEscrowIdsToMap,
  createMemoryTableRuntimeStore,
  type TableRuntimeStore,
} from './store.js';

export interface HandDisplay {
  userId: string;
  text: string;
  photo: string;
}

export interface TableActInput extends ActionInput {
  actionId: string;
  outcome?: string;
  winners?: string[];
  payoutAmount?: number;
}

interface Runtime {
  tableId: string;
  protocol: ProtocolTableState;
  boxEscrowIds: Map<string, string[]>;
}

export class TableService {
  private readonly handDisplays = new Map<string, Map<string, HandDisplay>>();

  constructor(
    private readonly escrow: EscrowService,
    private readonly auth: AuthService,
    private readonly ledger: PersonalLedger,
    private readonly runtimes: TableRuntimeStore = createMemoryTableRuntimeStore(),
  ) {}

  async snapshot(sessionToken: string, tableId: string) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    const table = await this.requireTable(tableId);
    await this.assertMember(tableId, viewer.id);
    const runtime = await this.ensureRuntime(tableId);
    if (await this.syncPlayers(runtime, tableId)) {
      await this.persistRuntime(runtime);
    }
    await this.applyOpeningCredits(tableId, table.ownerUserId);
    return this.view(tableId, viewer.id, runtime, table.ownerUserId);
  }

  async buyIn(sessionToken: string, tableId: string, amount: number) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    await this.requireTable(tableId);
    await this.assertMember(tableId, viewer.id);
    await this.escrow.ensureMasterWallet(viewer.id);
    await this.escrow.buyIn({ userId: viewer.id, tableId, amount, actorId: viewer.id });
    return this.snapshot(sessionToken, tableId);
  }

  async act(sessionToken: string, tableId: string, input: TableActInput) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    await this.requireTable(tableId);
    await this.assertMember(tableId, viewer.id);
    const runtime = await this.ensureRuntime(tableId);
    await this.syncPlayers(runtime, tableId);

    const applied = getAction(getProtocol(runtime.protocol.protocolId), input.actionId);
    assertActionAllowed(runtime.protocol, viewer.id, input.actionId, input);

    let lockedId: string | undefined;
    if (applied.locksChips) {
      const amount = input.amount;
      if (!amount || amount <= 0) {
        fail('AMOUNT_INVALID', 'A locking action needs a positive chip amount');
      }
      await this.escrow.ensureMasterWallet(viewer.id);
      if (!(await this.escrow.getGameWallet(viewer.id, tableId))) {
        fail('WALLET_NOT_FOUND', 'Buy in before locking chips');
      }
      lockedId = (
        await this.escrow.lock({
          escrowId: (
            await this.escrow.confirm({
              userId: viewer.id,
              tableId,
              amount,
              actorId: viewer.id,
            })
          ).id,
          actorId: viewer.id,
        })
      ).id;
    }

    runtime.protocol = applyAction(runtime.protocol, viewer.id, input.actionId, input);
    if (lockedId) {
      this.attachEscrow(runtime, viewer.id, input.boxId, lockedId, applied);
    }
    if (applied.resolvesPot) {
      await this.resolveTargets(runtime, tableId, viewer.id, input, applied);
    }
    if (input.payoutAmount != null) {
      await this.adjustTargets(runtime, tableId, viewer.id, input);
    }
    if (applied.releasesBox) {
      await this.releaseTargets(runtime, tableId, viewer.id, input);
    }
    if (applied.releasesPot) {
      await this.releaseResolved(runtime, tableId, viewer.id);
    }

    await this.persistRuntime(runtime);
    return this.snapshot(sessionToken, tableId);
  }

  async setHandDisplay(sessionToken: string, tableId: string, input: { text?: string; photo?: string }) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    await this.requireTable(tableId);
    await this.assertMember(tableId, viewer.id);
    await this.ensureRuntime(tableId);
    const text = input.text ?? '';
    const photo = input.photo ?? '';
    if (photo.length > 4_000_000) {
      fail('HAND_DISPLAY_TOO_LARGE', 'Photo is too large to store as a display aid');
    }
    this.setHand(tableId, { userId: viewer.id, text, photo });
    return this.snapshot(sessionToken, tableId);
  }

  async standings(sessionToken: string) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    return this.standingsView(viewer.id);
  }

  async saveStandings(sessionToken: string, otherUserId?: string) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    return this.ledger.save(viewer.id, otherUserId);
  }

  async clearStandings(sessionToken: string, otherUserId: string) {
    const viewer = await this.auth.requireSessionUser(sessionToken);
    if (!otherUserId) {
      fail('STANDING_REQUIRED', 'Clear needs the other user id');
    }
    return this.ledger.clear(viewer.id, otherUserId, viewer.id);
  }

  private async standingsView(viewerId: string) {
    const rows = await this.ledger.standingsFor(viewerId);
    return {
      userId: viewerId,
      rows: await Promise.all(
        rows.map(async (row) => ({
          ...row,
          otherLabel: await this.label(row.otherUserId),
        })),
      ),
      snapshots: await this.ledger.listSnapshots(viewerId),
    };
  }

  private async view(tableId: string, viewerId: string, runtime: Runtime, ownerUserId: string) {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const escrows = await this.escrow.listEscrowsForTable(tableId);
    const potAmount = escrows
      .filter((row) => row.state === 'CONFIRMED' || row.state === 'LOCKED')
      .reduce((sum, row) => sum + row.amount, 0);
    const allowed = listAllowedActions(runtime.protocol, viewerId);
    const game = await this.escrow.getGameWallet(viewerId, tableId);
    const master = await this.escrow.getMasterWallet(viewerId);

    return {
      tableId,
      protocolId: runtime.protocol.protocolId,
      phase: runtime.protocol.phase,
      flags: runtime.protocol.flags,
      boxes: await Promise.all(runtime.protocol.boxes.map((box) => this.boxView(runtime, tableId, box))),
      pot: { amount: potAmount },
      authorityUserId: peekAuthorityUserId(runtime.protocol),
      multipliers: protocol.multipliers ?? null,
      currentTurnUserId: getCurrentTurnUserId(runtime.protocol),
      settingsAccess: viewerId === ownerUserId,
      viewer: {
        id: viewerId,
        label: await this.label(viewerId),
        roles: viewerRoles(runtime.protocol, viewerId, ownerUserId),
        stack: game?.balance ?? 0,
        masterBalance: master?.balance ?? 0,
        allowedActions: allowed.map((action) => ({
          id: action.id,
          label: actionLabel(action),
          locksChips: Boolean(action.locksChips),
          requiresBox: Boolean(action.requiresBox || action.requiresOwnedBox),
          resolvesPot: Boolean(action.resolvesPot),
          releasesBox: Boolean(action.releasesBox),
        })),
        handDisplay: this.handDisplayFor(tableId, viewerId),
      },
      players: await Promise.all(
        runtime.protocol.playerIds.map(async (userId) => ({
          id: userId,
          label: await this.label(userId),
          stack: (await this.escrow.getGameWallet(userId, tableId))?.balance ?? 0,
          handDisplay: this.handDisplayFor(tableId, userId),
        })),
      ),
      payoutRule: protocol.payoutRule,
      invites: (await this.auth.listInvites(tableId)).map((invite) => ({
        id: invite.id,
        channel: invite.channel,
        label: invite.invitedEmail ?? invite.invitedPhone ?? `${invite.channel} invite`,
        openingChips: invite.openingChips,
        status: invite.claimedByUserId ? 'joined' : 'pending',
        claimedByUserId: invite.claimedByUserId,
        joinPath: viewerId === ownerUserId ? invite.joinPath : null,
        shareUrl:
          viewerId === ownerUserId && invite.channel === 'whatsapp'
            ? `https://wa.me/?text=${encodeURIComponent(`Join the table: ${invite.joinPath}`)}`
            : null,
      })),
    };
  }

  private async applyOpeningCredits(tableId: string, ownerUserId: string): Promise<void> {
    for (const invite of await this.auth.listInvites(tableId)) {
      if (!invite.claimedByUserId || invite.openingCredited || invite.openingChips <= 0) {
        continue;
      }
      await this.escrow.ensureMasterWallet(invite.claimedByUserId);
      await this.escrow.creditGame({
        userId: invite.claimedByUserId,
        tableId,
        amount: invite.openingChips,
        actorId: ownerUserId,
      });
      await this.auth.markOpeningCredited(invite.id);
    }
  }

  private async ensureRuntime(tableId: string): Promise<Runtime> {
    const existing = await this.runtimes.get(tableId);
    if (existing) {
      return {
        tableId,
        protocol: existing.protocol,
        boxEscrowIds: boxEscrowIdsToMap(existing.boxEscrowIds),
      };
    }
    const table = await this.requireTable(tableId);
    const members = await this.auth.listMemberIds(tableId);
    const playerIds = members.length ? members : [table.ownerUserId];
    const protocol = getProtocol(table.protocolId);
    const created: Runtime = {
      tableId,
      protocol: createProtocolTable({
        tableId,
        protocol,
        playerIds,
        tableOwnerUserId: table.ownerUserId,
        standingAuthorityUserId: null,
      }),
      boxEscrowIds: new Map(),
    };
    await this.persistRuntime(created);
    return created;
  }

  private async persistRuntime(runtime: Runtime): Promise<void> {
    await this.runtimes.put({
      tableId: runtime.tableId,
      protocol: runtime.protocol,
      boxEscrowIds: boxEscrowIdsFromMap(runtime.boxEscrowIds),
    });
  }

  private async syncPlayers(runtime: Runtime, tableId: string): Promise<boolean> {
    let changed = false;
    for (const memberId of await this.auth.listMemberIds(tableId)) {
      if (!runtime.protocol.playerIds.includes(memberId)) {
        runtime.protocol.playerIds.push(memberId);
        changed = true;
      }
    }
    return changed;
  }

  private async requireTable(tableId: string) {
    const table = await this.auth.getTable(tableId);
    if (!table) {
      fail('TABLE_NOT_FOUND', 'Table not found', 404);
    }
    return table;
  }

  private async assertMember(tableId: string, userId: string): Promise<void> {
    if (!(await this.auth.listMemberIds(tableId)).includes(userId)) {
      fail('FORBIDDEN', 'Not a member of this table', 403);
    }
  }

  private attachEscrow(
    runtime: Runtime,
    actorId: string,
    boxId: string | undefined,
    escrowId: string,
    action: ProtocolAction,
  ): void {
    const targetId =
      boxId ??
      [...runtime.protocol.boxes].reverse().find((box) => box.ownerUserId === actorId)?.id;
    if (!targetId) {
      return;
    }
    const list = runtime.boxEscrowIds.get(targetId) ?? [];
    list.push(escrowId);
    runtime.boxEscrowIds.set(targetId, list);
    if (action.splitsOwnedBox) {
      const newest = [...runtime.protocol.boxes].reverse().find((box) => box.id !== targetId && box.ownerUserId === actorId);
      if (newest) {
        runtime.boxEscrowIds.set(newest.id, [escrowId]);
      }
    }
  }

  private async resolveTargets(
    runtime: Runtime,
    tableId: string,
    actorId: string,
    input: TableActInput,
    action: ProtocolAction,
  ): Promise<void> {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    const targets = await this.targetEscrows(runtime, tableId, input);
    for (const row of targets) {
      if (row.state !== 'LOCKED') {
        continue;
      }
      await this.escrow.resolve({
        escrowId: row.id,
        actorId,
        protocolConfig: protocol,
        canResolve,
        outcome: input.outcome,
        winners: input.winners,
        counterpartyUserId: getAuthorityUserId(runtime.protocol),
      });
    }
    void action;
  }

  private async adjustTargets(runtime: Runtime, tableId: string, actorId: string, input: TableActInput): Promise<void> {
    const amount = input.payoutAmount;
    if (amount == null || !Number.isInteger(amount) || amount < 0) {
      fail('AMOUNT_INVALID', 'Edited payout must be a non-negative integer');
    }
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    for (const row of await this.targetEscrows(runtime, tableId, input)) {
      if (row.state !== 'RESOLVED' || !row.payout) {
        continue;
      }
      await this.escrow.setResolvedPayout({
        escrowId: row.id,
        actorId,
        protocolConfig: protocol,
        canResolve,
        credits: [{ userId: row.userId, amount }],
        counterpartyUserId: peekAuthorityUserId(runtime.protocol) ?? undefined,
      });
    }
  }

  private async releaseTargets(runtime: Runtime, tableId: string, actorId: string, input: TableActInput): Promise<void> {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    for (const row of await this.targetEscrows(runtime, tableId, input)) {
      const current = (await this.escrow.listEscrowsForTable(tableId)).find((item) => item.id === row.id);
      if (current?.state !== 'RESOLVED') {
        continue;
      }
      await this.escrow.release({
        escrowId: current.id,
        actorId,
        protocolConfig: protocol,
        canResolve,
      });
    }
  }

  private async boxView(runtime: Runtime, tableId: string, box: Box) {
    const ids = new Set(runtime.boxEscrowIds.get(box.id) ?? []);
    const attached = (await this.escrow.listEscrowsForTable(tableId)).filter((row) => ids.has(row.id));
    const primary = attached[0];
    const credit = primary?.payout?.credits.find((item) => item.userId === box.ownerUserId);
    return {
      id: box.id,
      ownerUserId: box.ownerUserId,
      ownerLabel: await this.label(box.ownerUserId),
      stake: box.stake,
      status: box.status,
      escrowState: primary?.state ?? null,
      outcome: primary?.payout?.outcome ?? null,
      suggestedPayout: credit?.amount ?? null,
    };
  }

  private async releaseResolved(runtime: Runtime, tableId: string, actorId: string): Promise<void> {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    for (const row of await this.escrow.listEscrowsForTable(tableId)) {
      if (row.state !== 'RESOLVED') {
        continue;
      }
      await this.escrow.release({
        escrowId: row.id,
        actorId,
        protocolConfig: protocol,
        canResolve,
      });
    }
  }

  private async targetEscrows(runtime: Runtime, tableId: string, input: TableActInput): Promise<Escrow[]> {
    if (input.boxId) {
      const ids = new Set(runtime.boxEscrowIds.get(input.boxId) ?? []);
      return (await this.escrow.listEscrowsForTable(tableId)).filter((row) => ids.has(row.id));
    }
    return this.escrow.listEscrowsForTable(tableId);
  }

  private async label(userId: string): Promise<string> {
    const user = await this.auth.getUser(userId);
    return user?.email ?? user?.phone ?? userId;
  }

  private handDisplayFor(tableId: string, userId: string): HandDisplay {
    return this.handDisplays.get(tableId)?.get(userId) ?? { userId, text: '', photo: '' };
  }

  private setHand(tableId: string, display: HandDisplay): void {
    const byUser = this.handDisplays.get(tableId) ?? new Map<string, HandDisplay>();
    byUser.set(display.userId, display);
    this.handDisplays.set(tableId, byUser);
  }
}

export function createTableService(
  escrow: EscrowService,
  auth: AuthService,
  ledger: PersonalLedger,
  runtimeStore?: TableRuntimeStore,
): TableService {
  return new TableService(escrow, auth, ledger, runtimeStore ?? createMemoryTableRuntimeStore());
}

function viewerRoles(
  state: ProtocolTableState,
  viewerId: string,
  ownerUserId: string,
): string[] {
  const roles: string[] = [];
  if (viewerId === ownerUserId) {
    roles.push('table-owner');
  }
  if (viewerId === peekAuthorityUserId(state)) {
    roles.push(getProtocol(state.protocolId).authorityRole);
  }
  if (state.playerIds.includes(viewerId)) {
    roles.push('player');
    if (viewerId !== getCurrentTurnUserId(state)) {
      roles.push('other-players');
    }
  }
  return roles;
}

function actionLabel(action: ProtocolAction): string {
  if (action.label) {
    return action.label;
  }
  return action.id
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}
