import type { Box, ProtocolTableState } from '../protocol/types.js';

export interface TableRuntimeRecord {
  tableId: string;
  protocol: ProtocolTableState;
  boxEscrowIds: Record<string, string[]>;
}

export interface TableRuntimeStore {
  get(tableId: string): Promise<TableRuntimeRecord | undefined>;
  put(record: TableRuntimeRecord): Promise<void>;
}

export function createMemoryTableRuntimeStore(): TableRuntimeStore {
  const runtimes = new Map<string, TableRuntimeRecord>();

  return {
    async get(tableId) {
      const row = runtimes.get(tableId);
      return row ? cloneRuntime(row) : undefined;
    },
    async put(record) {
      runtimes.set(record.tableId, cloneRuntime(record));
    },
  };
}

export function cloneRuntime(record: TableRuntimeRecord): TableRuntimeRecord {
  return {
    tableId: record.tableId,
    protocol: cloneProtocol(record.protocol),
    boxEscrowIds: Object.fromEntries(
      Object.entries(record.boxEscrowIds).map(([boxId, ids]) => [boxId, [...ids]]),
    ),
  };
}

function cloneProtocol(state: ProtocolTableState): ProtocolTableState {
  return {
    ...state,
    playerIds: [...state.playerIds],
    flags: { ...state.flags },
    boxes: state.boxes.map((box: Box) => ({ ...box })),
  };
}

export function boxEscrowIdsFromMap(map: Map<string, string[]>): Record<string, string[]> {
  return Object.fromEntries([...map.entries()].map(([boxId, ids]) => [boxId, [...ids]]));
}

export function boxEscrowIdsToMap(record: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(record).map(([boxId, ids]) => [boxId, [...ids]]));
}
