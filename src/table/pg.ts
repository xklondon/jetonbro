import type { Pool } from 'pg';
import type { ProtocolTableState } from '../protocol/types.js';
import { cloneRuntime, type TableRuntimeRecord, type TableRuntimeStore } from './store.js';

interface RuntimeRow {
  table_id: string;
  protocol: ProtocolTableState;
  box_escrow_ids: Record<string, string[]>;
}

export function createPgTableRuntimeStore(pool: Pool): TableRuntimeStore {
  return {
    async get(tableId) {
      const result = await pool.query<RuntimeRow>('SELECT * FROM table_runtimes WHERE table_id = $1', [tableId]);
      const row = result.rows[0];
      if (!row) {
        return undefined;
      }
      return cloneRuntime({
        tableId: row.table_id,
        protocol: row.protocol,
        boxEscrowIds: row.box_escrow_ids,
      });
    },
    async put(record) {
      const copy = cloneRuntime(record);
      await pool.query(
        `INSERT INTO table_runtimes (table_id, protocol, box_escrow_ids)
         VALUES ($1, $2, $3)
         ON CONFLICT (table_id) DO UPDATE SET protocol = EXCLUDED.protocol, box_escrow_ids = EXCLUDED.box_escrow_ids`,
        [copy.tableId, JSON.stringify(copy.protocol), JSON.stringify(copy.boxEscrowIds)],
      );
    },
  };
}
