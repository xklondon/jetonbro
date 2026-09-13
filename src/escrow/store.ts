import type { Escrow, LedgerRow, Wallet } from './types.js';

export interface EscrowStore {
  insertWallet(wallet: Wallet): void;
  updateWallet(wallet: Wallet): void;
  getWalletById(id: string): Wallet | undefined;
  getMasterWallet(userId: string): Wallet | undefined;
  getGameWallet(userId: string, tableId: string): Wallet | undefined;
  listWallets(): Wallet[];
  insertEscrow(escrow: Escrow): void;
  updateEscrow(escrow: Escrow): void;
  getEscrow(id: string): Escrow | undefined;
  listEscrows(): Escrow[];
  insertLedger(row: LedgerRow): void;
  listLedger(): LedgerRow[];
}

export function createMemoryStore(): EscrowStore {
  const wallets = new Map<string, Wallet>();
  const escrows = new Map<string, Escrow>();
  const ledger: LedgerRow[] = [];

  return {
    insertWallet(wallet) {
      wallets.set(wallet.id, { ...wallet });
    },
    updateWallet(wallet) {
      wallets.set(wallet.id, { ...wallet });
    },
    getWalletById(id) {
      const row = wallets.get(id);
      return row ? { ...row } : undefined;
    },
    getMasterWallet(userId) {
      for (const wallet of wallets.values()) {
        if (wallet.userId === userId && wallet.type === 'master') {
          return { ...wallet };
        }
      }
      return undefined;
    },
    getGameWallet(userId, tableId) {
      for (const wallet of wallets.values()) {
        if (wallet.userId === userId && wallet.type === 'game' && wallet.tableId === tableId) {
          return { ...wallet };
        }
      }
      return undefined;
    },
    listWallets() {
      return [...wallets.values()].map((wallet) => ({ ...wallet }));
    },
    insertEscrow(escrow) {
      escrows.set(escrow.id, cloneEscrow(escrow));
    },
    updateEscrow(escrow) {
      escrows.set(escrow.id, cloneEscrow(escrow));
    },
    getEscrow(id) {
      const row = escrows.get(id);
      return row ? cloneEscrow(row) : undefined;
    },
    listEscrows() {
      return [...escrows.values()].map((escrow) => cloneEscrow(escrow));
    },
    insertLedger(row) {
      ledger.push({ ...row });
    },
    listLedger() {
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
