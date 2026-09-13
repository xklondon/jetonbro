import type { Escrow, LedgerRow, Wallet } from './types.js';

export interface EscrowStore {
  insertWallet(wallet: Wallet): Promise<void>;
  updateWallet(wallet: Wallet): Promise<void>;
  getWalletById(id: string): Promise<Wallet | undefined>;
  getMasterWallet(userId: string): Promise<Wallet | undefined>;
  getGameWallet(userId: string, tableId: string): Promise<Wallet | undefined>;
  listWallets(): Promise<Wallet[]>;
  insertEscrow(escrow: Escrow): Promise<void>;
  updateEscrow(escrow: Escrow): Promise<void>;
  getEscrow(id: string): Promise<Escrow | undefined>;
  listEscrows(): Promise<Escrow[]>;
  insertLedger(row: LedgerRow): Promise<void>;
  listLedger(): Promise<LedgerRow[]>;
}

export function createMemoryStore(): EscrowStore {
  const wallets = new Map<string, Wallet>();
  const escrows = new Map<string, Escrow>();
  const ledger: LedgerRow[] = [];

  return {
    async insertWallet(wallet) {
      wallets.set(wallet.id, { ...wallet });
    },
    async updateWallet(wallet) {
      wallets.set(wallet.id, { ...wallet });
    },
    async getWalletById(id) {
      const row = wallets.get(id);
      return row ? { ...row } : undefined;
    },
    async getMasterWallet(userId) {
      for (const wallet of wallets.values()) {
        if (wallet.userId === userId && wallet.type === 'master') {
          return { ...wallet };
        }
      }
      return undefined;
    },
    async getGameWallet(userId, tableId) {
      for (const wallet of wallets.values()) {
        if (wallet.userId === userId && wallet.type === 'game' && wallet.tableId === tableId) {
          return { ...wallet };
        }
      }
      return undefined;
    },
    async listWallets() {
      return [...wallets.values()].map((wallet) => ({ ...wallet }));
    },
    async insertEscrow(escrow) {
      escrows.set(escrow.id, cloneEscrow(escrow));
    },
    async updateEscrow(escrow) {
      escrows.set(escrow.id, cloneEscrow(escrow));
    },
    async getEscrow(id) {
      const row = escrows.get(id);
      return row ? cloneEscrow(row) : undefined;
    },
    async listEscrows() {
      return [...escrows.values()].map((escrow) => cloneEscrow(escrow));
    },
    async insertLedger(row) {
      ledger.push({ ...row });
    },
    async listLedger() {
      return ledger.map((row) => ({ ...row }));
    },
  };
}

function cloneEscrow(escrow: Escrow): Escrow {
  return {
    ...escrow,
    payout: escrow.payout
      ? {
          ...escrow.payout,
          credits: escrow.payout.credits.map((c) => ({ ...c })),
        }
      : undefined,
  };
}
