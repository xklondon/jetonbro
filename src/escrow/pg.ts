import type { Pool } from 'pg';
import type { Escrow, LedgerRow, ResolvedPayout, Wallet } from './types.js';
import type { EscrowStore } from './store.js';

interface WalletRow {
  id: string;
  user_id: string;
  type: Wallet['type'];
  table_id: string | null;
  balance: number;
}

interface EscrowRow {
  id: string;
  table_id: string;
  user_id: string;
  amount: number;
  state: Escrow['state'];
  resolved_by: string | null;
  payout: ResolvedPayout | null;
}

interface LedgerDbRow {
  id: string;
  at: string;
  actor_id: string;
  amount: number;
  kind: LedgerRow['kind'];
  escrow_id: string | null;
  from_state: LedgerRow['fromState'];
  to_state: LedgerRow['toState'];
  declared_by: string | null;
  detail: string | null;
}

export function createPgEscrowStore(pool: Pool): EscrowStore {
  return {
    async insertWallet(wallet) {
      await pool.query(
        `INSERT INTO wallets (id, user_id, type, table_id, balance)
         VALUES ($1, $2, $3, $4, $5)`,
        [wallet.id, wallet.userId, wallet.type, wallet.tableId, wallet.balance],
      );
    },
    async updateWallet(wallet) {
      await pool.query(
        `UPDATE wallets SET user_id = $2, type = $3, table_id = $4, balance = $5 WHERE id = $1`,
        [wallet.id, wallet.userId, wallet.type, wallet.tableId, wallet.balance],
      );
    },
    async getWalletById(id) {
      const result = await pool.query<WalletRow>('SELECT * FROM wallets WHERE id = $1', [id]);
      return result.rows[0] ? toWallet(result.rows[0]) : undefined;
    },
    async getMasterWallet(userId) {
      const result = await pool.query<WalletRow>(
        `SELECT * FROM wallets WHERE user_id = $1 AND type = 'master'`,
        [userId],
      );
      return result.rows[0] ? toWallet(result.rows[0]) : undefined;
    },
    async getGameWallet(userId, tableId) {
      const result = await pool.query<WalletRow>(
        `SELECT * FROM wallets WHERE user_id = $1 AND type = 'game' AND table_id = $2`,
        [userId, tableId],
      );
      return result.rows[0] ? toWallet(result.rows[0]) : undefined;
    },
    async listWallets() {
      const result = await pool.query<WalletRow>('SELECT * FROM wallets');
      return result.rows.map(toWallet);
    },
    async insertEscrow(escrow) {
      await pool.query(
        `INSERT INTO escrows (id, table_id, user_id, amount, state, resolved_by, payout)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          escrow.id,
          escrow.tableId,
          escrow.userId,
          escrow.amount,
          escrow.state,
          escrow.resolvedBy ?? null,
          escrow.payout ? JSON.stringify(escrow.payout) : null,
        ],
      );
    },
    async updateEscrow(escrow) {
      await pool.query(
        `UPDATE escrows SET table_id = $2, user_id = $3, amount = $4, state = $5, resolved_by = $6, payout = $7
         WHERE id = $1`,
        [
          escrow.id,
          escrow.tableId,
          escrow.userId,
          escrow.amount,
          escrow.state,
          escrow.resolvedBy ?? null,
          escrow.payout ? JSON.stringify(escrow.payout) : null,
        ],
      );
    },
    async getEscrow(id) {
      const result = await pool.query<EscrowRow>('SELECT * FROM escrows WHERE id = $1', [id]);
      return result.rows[0] ? toEscrow(result.rows[0]) : undefined;
    },
    async listEscrows() {
      const result = await pool.query<EscrowRow>('SELECT * FROM escrows');
      return result.rows.map(toEscrow);
    },
    async insertLedger(row) {
      await pool.query(
        `INSERT INTO escrow_ledger
           (id, at, actor_id, amount, kind, escrow_id, from_state, to_state, declared_by, detail)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          row.id,
          row.at,
          row.actorId,
          row.amount,
          row.kind,
          row.escrowId,
          row.fromState,
          row.toState,
          row.declaredBy ?? null,
          row.detail ?? null,
        ],
      );
    },
    async listLedger() {
      const result = await pool.query<LedgerDbRow>('SELECT * FROM escrow_ledger ORDER BY n');
      return result.rows.map(toLedger);
    },
  };
}

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    tableId: row.table_id,
    balance: Number(row.balance),
  };
}

function toEscrow(row: EscrowRow): Escrow {
  const escrow: Escrow = {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    amount: Number(row.amount),
    state: row.state,
  };
  if (row.resolved_by) {
    escrow.resolvedBy = row.resolved_by;
  }
  if (row.payout) {
    escrow.payout = row.payout;
  }
  return escrow;
}

function toLedger(row: LedgerDbRow): LedgerRow {
  const item: LedgerRow = {
    id: row.id,
    at: row.at,
    actorId: row.actor_id,
    amount: Number(row.amount),
    kind: row.kind,
    escrowId: row.escrow_id,
    fromState: row.from_state,
    toState: row.to_state,
  };
  if (row.declared_by) {
    item.declaredBy = row.declared_by;
  }
  if (row.detail) {
    item.detail = row.detail;
  }
  return item;
}
