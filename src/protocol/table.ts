import { fail } from './errors.js';
import { getProtocol } from './configs.js';
import type { AuthorityMode, ProtocolConfig, ProtocolTableState } from './types.js';

export interface CreateProtocolTableInput {
  tableId: string;
  protocol: ProtocolConfig;
  playerIds: string[];
  tableOwnerUserId?: string;
  /** Blackjack table setting. Ignored unless the protocol allows an override. */
  authorityMode?: AuthorityMode;
  standingAuthorityUserId?: string;
}

export function createProtocolTable(input: CreateProtocolTableInput): ProtocolTableState {
  if (input.playerIds.length === 0) {
    fail('TABLE_INVALID', 'A protocol table needs at least one player');
  }
  const protocol = getProtocol(input.protocol.id);
  const unique = new Set(input.playerIds);
  if (unique.size !== input.playerIds.length) {
    fail('TABLE_INVALID', 'Player list must be unique and ordered');
  }

  let authorityMode = protocol.authorityMode;
  if (input.authorityMode && input.authorityMode !== protocol.authorityMode) {
    if (!protocol.authorityModeEditable) {
      fail('TABLE_INVALID', `${protocol.id} does not allow an authority-mode override`);
    }
    authorityMode = input.authorityMode;
  }

  const standingAuthorityUserId =
    authorityMode === 'standing'
      ? (input.standingAuthorityUserId ?? input.playerIds[0]!)
      : null;

  return {
    tableId: input.tableId,
    protocolId: protocol.id,
    phase: protocol.phases[0]!,
    playerIds: [...input.playerIds],
    currentTurnIndex: 0,
    authorityIndex: 0,
    authorityMode,
    standingAuthorityUserId,
    tableOwnerUserId: input.tableOwnerUserId ?? null,
    flags: {},
    activeSeatUserId: input.playerIds[0] ?? null,
    boxes: [],
  };
}

export function getAuthorityUserId(state: ProtocolTableState): string {
  if (state.authorityMode === 'standing') {
    if (!state.standingAuthorityUserId) {
      fail('TABLE_INVALID', 'Standing authority is not set');
    }
    return state.standingAuthorityUserId;
  }
  return state.playerIds[state.authorityIndex]!;
}

export function getCurrentTurnUserId(state: ProtocolTableState): string {
  return state.playerIds[state.currentTurnIndex]!;
}
