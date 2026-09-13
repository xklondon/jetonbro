import type { AuthService } from '../auth/service.js';
import type { EscrowService } from '../escrow/service.js';
import type { Escrow, Wallet } from '../escrow/types.js';
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
} from '../protocol/index.js';
import { fail } from '../auth/errors.js';
import type { ActionInput, ProtocolAction, ProtocolTableState } from '../protocol/types.js';

export interface HandDisplay {
  userId: string;
  text: string;
  photo: string;
}

export interface TableActInput extends ActionInput {
  actionId: string;
  outcome?: string;
  winners?: string[];
}

interface Runtime {
  protocol: ProtocolTableState;
  handDisplays: Map<string, HandDisplay>;
  boxEscrowIds: Map<string, string[]>;
}

export class TableService {
  private readonly runtimes = new Map<string, Runtime>();

  constructor(
    private readonly escrow: EscrowService,
    private readonly auth: AuthService,
    private readonly ledger: PersonalLedger,
  ) {}

  snapshot(sessionToken: string, tableId: string) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    const table = this.requireTable(tableId);
    this.assertMember(tableId, viewer.id);
    const runtime = this.ensureRuntime(tableId);
    this.syncPlayers(runtime, tableId);
    return this.view(tableId, viewer.id, runtime, table.ownerUserId);
  }

  buyIn(sessionToken: string, tableId: string, amount: number) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    this.requireTable(tableId);
    this.assertMember(tableId, viewer.id);
    this.escrow.ensureMasterWallet(viewer.id);
    this.escrow.buyIn({ userId: viewer.id, tableId, amount, actorId: viewer.id });
    return this.snapshot(sessionToken, tableId);
  }

  act(sessionToken: string, tableId: string, input: TableActInput) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    this.requireTable(tableId);
    this.assertMember(tableId, viewer.id);
    const runtime = this.ensureRuntime(tableId);
    this.syncPlayers(runtime, tableId);

    const applied = getAction(getProtocol(runtime.protocol.protocolId), input.actionId);
    assertActionAllowed(runtime.protocol, viewer.id, input.actionId, input);

    if (applied.creditsGame) {
      const amount = input.amount;
      const targetUserId = input.targetUserId;
      if (!amount || amount <= 0 || !targetUserId) {
        fail('AMOUNT_INVALID', 'Assign/top-up needs a target player and a positive amount');
      }
      this.escrow.ensureMasterWallet(targetUserId);
      this.escrow.creditGame({ userId: targetUserId, tableId, amount, actorId: viewer.id });
    }

    let lockedId: string | undefined;
    if (applied.locksChips) {
      const amount = input.amount;
      if (!amount || amount <= 0) {
        fail('AMOUNT_INVALID', 'A locking action needs a positive chip amount');
      }
      this.escrow.ensureMasterWallet(viewer.id);
      if (!this.escrow.getGameWallet(viewer.id, tableId)) {
        fail('WALLET_NOT_FOUND', 'Buy in before locking chips');
      }
      lockedId = this.escrow.lock({
        escrowId: this.escrow.confirm({
          userId: viewer.id,
          tableId,
          amount,
          actorId: viewer.id,
        }).id,
        actorId: viewer.id,
      }).id;
    }

    runtime.protocol = applyAction(runtime.protocol, viewer.id, input.actionId, input);
    if (lockedId) {
      this.attachEscrow(runtime, viewer.id, input.boxId, lockedId, applied);
    }
    if (applied.resolvesPot) {
      this.resolveTargets(runtime, tableId, viewer.id, input, applied);
    }
    if (applied.releasesPot) {
      this.releaseResolved(runtime, tableId, viewer.id);
    }

    return this.snapshot(sessionToken, tableId);
  }

  setHandDisplay(sessionToken: string, tableId: string, input: { text?: string; photo?: string }) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    this.requireTable(tableId);
    this.assertMember(tableId, viewer.id);
    const runtime = this.ensureRuntime(tableId);
    const text = input.text ?? '';
    const photo = input.photo ?? '';
    if (photo.length > 4_000_000) {
      fail('HAND_DISPLAY_TOO_LARGE', 'Photo is too large to store as a display aid');
    }
    runtime.handDisplays.set(viewer.id, { userId: viewer.id, text, photo });
    return this.snapshot(sessionToken, tableId);
  }

  standings(sessionToken: string) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    return {
      userId: viewer.id,
      rows: this.ledger.standingsFor(viewer.id).map((row) => ({
        ...row,
        otherLabel: this.label(row.otherUserId),
      })),
      snapshots: this.ledger.listSnapshots(viewer.id),
    };
  }

  saveStandings(sessionToken: string, otherUserId?: string) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    return this.ledger.save(viewer.id, otherUserId);
  }

  clearStandings(sessionToken: string, otherUserId: string) {
    const viewer = this.auth.requireSessionUser(sessionToken);
    if (!otherUserId) {
      fail('STANDING_REQUIRED', 'Clear needs the other user id');
    }
    return this.ledger.clear(viewer.id, otherUserId, viewer.id);
  }

  private view(tableId: string, viewerId: string, runtime: Runtime, ownerUserId: string) {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const escrows = this.escrow.listEscrowsForTable(tableId);
    const potAmount = escrows
      .filter((row) => row.state === 'CONFIRMED' || row.state === 'LOCKED')
      .reduce((sum, row) => sum + row.amount, 0);
    const allowed = listAllowedActions(runtime.protocol, viewerId);
    const game = this.escrow.getGameWallet(viewerId, tableId);
    const master = this.escrow.getMasterWallet(viewerId);

    return {
      tableId,
      protocolId: runtime.protocol.protocolId,
      phase: runtime.protocol.phase,
      flags: runtime.protocol.flags,
      boxes: runtime.protocol.boxes,
      pot: { amount: potAmount },
      authorityUserId: getAuthorityUserId(runtime.protocol),
      currentTurnUserId: getCurrentTurnUserId(runtime.protocol),
      settingsAccess: viewerId === ownerUserId,
      viewer: {
        id: viewerId,
        label: this.label(viewerId),
        roles: viewerRoles(runtime.protocol, viewerId, ownerUserId),
        stack: game?.balance ?? 0,
        masterBalance: master?.balance ?? 0,
        allowedActions: allowed.map((action) => ({
          id: action.id,
          label: actionLabel(action),
          locksChips: Boolean(action.locksChips),
          requiresBox: Boolean(action.requiresBox || action.requiresOwnedBox),
          creditsGame: Boolean(action.creditsGame),
          resolvesPot: Boolean(action.resolvesPot),
        })),
        handDisplay: runtime.handDisplays.get(viewerId) ?? { userId: viewerId, text: '', photo: '' },
      },
      players: runtime.protocol.playerIds.map((userId) => ({
        id: userId,
        label: this.label(userId),
        stack: this.escrow.getGameWallet(userId, tableId)?.balance ?? 0,
        handDisplay: runtime.handDisplays.get(userId) ?? { userId, text: '', photo: '' },
      })),
      payoutRule: protocol.payoutRule,
    };
  }

  private ensureRuntime(tableId: string): Runtime {
    const existing = this.runtimes.get(tableId);
    if (existing) {
      return existing;
    }
    const table = this.requireTable(tableId);
    const members = this.auth.listMemberIds(tableId);
    const playerIds = members.length ? members : [table.ownerUserId];
    const protocol = getProtocol(table.protocolId);
    const created: Runtime = {
      protocol: createProtocolTable({
        tableId,
        protocol,
        playerIds,
        tableOwnerUserId: table.ownerUserId,
        standingAuthorityUserId: table.ownerUserId,
      }),
      handDisplays: new Map(),
      boxEscrowIds: new Map(),
    };
    this.runtimes.set(tableId, created);
    return created;
  }

  private syncPlayers(runtime: Runtime, tableId: string): void {
    for (const memberId of this.auth.listMemberIds(tableId)) {
      if (!runtime.protocol.playerIds.includes(memberId)) {
        runtime.protocol.playerIds.push(memberId);
      }
    }
  }

  private requireTable(tableId: string) {
    const table = this.auth.getTable(tableId);
    if (!table) {
      fail('TABLE_NOT_FOUND', 'Table not found', 404);
    }
    return table;
  }

  private assertMember(tableId: string, userId: string): void {
    if (!this.auth.listMemberIds(tableId).includes(userId)) {
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

  private resolveTargets(
    runtime: Runtime,
    tableId: string,
    actorId: string,
    input: TableActInput,
    action: ProtocolAction,
  ): void {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    const targets = this.targetEscrows(runtime, tableId, input);
    for (const row of targets) {
      if (row.state !== 'LOCKED') {
        continue;
      }
      this.escrow.resolve({
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

  private releaseResolved(runtime: Runtime, tableId: string, actorId: string): void {
    const protocol = getProtocol(runtime.protocol.protocolId);
    const canResolve = canResolveForTable(runtime.protocol);
    for (const row of this.escrow.listEscrowsForTable(tableId)) {
      if (row.state !== 'RESOLVED') {
        continue;
      }
      this.escrow.release({
        escrowId: row.id,
        actorId,
        protocolConfig: protocol,
        canResolve,
      });
    }
  }

  private targetEscrows(runtime: Runtime, tableId: string, input: TableActInput): Escrow[] {
    if (input.boxId) {
      const ids = new Set(runtime.boxEscrowIds.get(input.boxId) ?? []);
      return this.escrow.listEscrowsForTable(tableId).filter((row) => ids.has(row.id));
    }
    return this.escrow.listEscrowsForTable(tableId);
  }

  private label(userId: string): string {
    const user = this.auth.getUser(userId);
    return user?.email ?? user?.phone ?? userId;
  }
}

export function createTableService(
  escrow: EscrowService,
  auth: AuthService,
  ledger: PersonalLedger,
): TableService {
  return new TableService(escrow, auth, ledger);
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
  if (viewerId === getAuthorityUserId(state)) {
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
  return action.id
    .split('-')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ');
}

