import { randomUUID } from 'node:crypto';
import { fail } from './errors.js';
import { getProtocol } from './configs.js';
import { getAuthorityUserId, getCurrentTurnUserId } from './table.js';
import type {
  ActionInput,
  Box,
  ProtocolAction,
  ProtocolConfig,
  ProtocolRole,
  ProtocolTableState,
} from './types.js';

export function getAction(protocol: ProtocolConfig, actionId: string): ProtocolAction {
  const action = protocol.actions.find((item) => item.id === actionId);
  if (!action) {
    fail('ACTION_UNKNOWN', `Action "${actionId}" is not on protocol ${protocol.id}`);
  }
  return action;
}

export function assertPhaseRole(
  state: ProtocolTableState,
  actorId: string,
  actionId: string,
): ProtocolAction {
  const protocol = getProtocol(state.protocolId);
  const action = getAction(protocol, actionId);
  if (action.phase !== state.phase) {
    fail('ACTION_PHASE', `Action "${actionId}" is not available in phase "${state.phase}"`);
  }
  if (action.requiresFlag && !state.flags[action.requiresFlag]) {
    fail('ACTION_FLAG', `Action "${actionId}" requires ${action.requiresFlag}`);
  }
  assertRole(state, protocol, actorId, action);
  return action;
}

export function assertActionAllowed(
  state: ProtocolTableState,
  actorId: string,
  actionId: string,
  input: ActionInput = {},
): ProtocolAction {
  const action = assertPhaseRole(state, actorId, actionId);
  if (action.requiresOwnedBox || action.requiresBox || input.boxId) {
    resolveBox(state, actorId, action, input);
  }
  return action;
}

export function listAllowedActions(state: ProtocolTableState, actorId: string): ProtocolAction[] {
  const protocol = getProtocol(state.protocolId);
  return protocol.actions.filter((action) => {
    try {
      assertPhaseRole(state, actorId, action.id);
      return true;
    } catch {
      return false;
    }
  });
}

export function applyAction(
  state: ProtocolTableState,
  actorId: string,
  actionId: string,
  input: ActionInput = {},
): ProtocolTableState {
  const action = assertActionAllowed(state, actorId, actionId, input);
  const next: ProtocolTableState = {
    ...state,
    playerIds: [...state.playerIds],
    flags: { ...state.flags, ...(action.setFlags ?? {}) },
    boxes: state.boxes.map((box) => ({ ...box })),
  };

  if (action.nextPhase) {
    next.phase = action.nextPhase;
  }

  if (protocolRoleIsPlayer(action.role) && getProtocol(state.protocolId).turnEnforcement === 'display-only') {
    next.activeSeatUserId = actorId;
  }

  if (action.advanceTurn) {
    next.currentTurnIndex = (next.currentTurnIndex + 1) % next.playerIds.length;
  }

  if (action.rotateAuthority && next.authorityMode === 'rotating') {
    next.authorityIndex = (next.authorityIndex + 1) % next.playerIds.length;
    applyAfterRotateTurn(next, action.afterRotateTurn);
  }

  applyBoxEffects(next, actorId, action, input);
  return next;
}

function resolveBox(
  state: ProtocolTableState,
  actorId: string,
  action: ProtocolAction,
  input: ActionInput,
): Box {
  let box: Box | undefined;
  if (input.boxId) {
    box = state.boxes.find((item) => item.id === input.boxId);
    if (!box) {
      fail('BOX_NOT_FOUND', 'Box not found');
    }
  } else if (action.requiresOwnedBox || action.createsOwnedBox) {
    const owned = state.boxes.filter((item) => item.ownerUserId === actorId);
    if (owned.length === 1) {
      box = owned[0];
    } else if (owned.length > 1) {
      fail('BOX_REQUIRED', 'Choose which box to act on');
    }
  }

  if ((action.requiresBox || action.requiresOwnedBox) && !box) {
    fail('BOX_NOT_FOUND', 'Box not found');
  }
  if (box && (action.requiresOwnedBox || action.createsOwnedBox || action.addsToOwnedBox || action.splitsOwnedBox)) {
    if (box.ownerUserId !== actorId) {
      fail('BOX_OWNERSHIP', 'You can only act on your own box');
    }
  }
  return box as Box;
}

function applyBoxEffects(
  state: ProtocolTableState,
  actorId: string,
  action: ProtocolAction,
  input: ActionInput,
): void {
  const amount = input.amount ?? 0;

  if (action.createsOwnedBox) {
    const existing = input.boxId
      ? state.boxes.find((box) => box.id === input.boxId)
      : state.boxes.find((box) => box.ownerUserId === actorId && box.status === 'open');
    if (existing) {
      existing.stake += amount;
    } else {
      state.boxes.push({
        id: randomUUID(),
        ownerUserId: actorId,
        stake: amount,
        status: 'open',
      });
    }
  }

  if (action.addsToOwnedBox) {
    const box = resolveBox(state, actorId, action, input);
    box.stake += amount > 0 ? amount : box.stake;
  }

  if (action.splitsOwnedBox) {
    const box = resolveBox(state, actorId, action, input);
    state.boxes.push({
      id: randomUUID(),
      ownerUserId: actorId,
      stake: box.stake,
      status: box.status,
    });
  }

  if (action.locksAllBoxes) {
    for (const box of state.boxes) {
      if (box.status === 'open') {
        box.status = 'locked';
      }
    }
  }

  if (action.resolvesBox) {
    const box = resolveBox(state, actorId, action, input);
    box.status = 'resolved';
  }
}

function assertRole(
  state: ProtocolTableState,
  protocol: ProtocolConfig,
  actorId: string,
  action: ProtocolAction,
): void {
  const role = action.role;
  if (role === 'turn-holder') {
    if (actorId !== getCurrentTurnUserId(state)) {
      fail('TURN_ORDER', 'Only the current turn-holder may perform this action');
    }
    if (actorId !== getAuthorityUserId(state)) {
      fail('UNAUTHORIZED', `Only the current ${role} may perform "${action.id}"`);
    }
    return;
  }
  if (isAuthorityRole(role)) {
    if (actorId !== getAuthorityUserId(state)) {
      fail('UNAUTHORIZED', `Only the current ${role} may perform "${action.id}"`);
    }
    return;
  }
  if (role === 'table-owner') {
    if (!state.tableOwnerUserId || actorId !== state.tableOwnerUserId) {
      fail('UNAUTHORIZED', 'Only the table owner may perform this action');
    }
    return;
  }
  if (role === 'other-players') {
    if (actorId === getCurrentTurnUserId(state)) {
      fail('UNAUTHORIZED', 'The current turn-holder cannot perform this action');
    }
    if (!state.playerIds.includes(actorId)) {
      fail('UNAUTHORIZED', 'Actor is not seated at this table');
    }
    return;
  }
  if (role === 'player') {
    if (!state.playerIds.includes(actorId)) {
      fail('UNAUTHORIZED', 'Actor is not seated at this table');
    }
    if (protocol.turnEnforcement === 'required' && !action.ignoreTurn && actorId !== getCurrentTurnUserId(state)) {
      fail('TURN_ORDER', 'Only the current player may perform this action');
    }
    return;
  }
  fail('UNAUTHORIZED', `Unsupported role "${role}"`);
}

function isAuthorityRole(role: ProtocolRole): boolean {
  return role === 'bank' || role === 'dealer' || role === 'turn-holder';
}

function protocolRoleIsPlayer(role: ProtocolRole): boolean {
  return role === 'player' || role === 'turn-holder';
}

function applyAfterRotateTurn(
  state: ProtocolTableState,
  after: ProtocolAction['afterRotateTurn'],
): void {
  if (after === 'authority') {
    state.currentTurnIndex = state.authorityIndex;
    state.activeSeatUserId = state.playerIds[state.authorityIndex]!;
    return;
  }
  if (after === 'next-after-authority') {
    state.currentTurnIndex = (state.authorityIndex + 1) % state.playerIds.length;
    state.activeSeatUserId = state.playerIds[state.currentTurnIndex]!;
    return;
  }
  if (after === 'first') {
    state.currentTurnIndex = 0;
    state.activeSeatUserId = state.playerIds[0]!;
  }
}
