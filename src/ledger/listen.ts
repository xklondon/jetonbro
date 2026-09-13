import type { EscrowStore } from '../escrow/store.js';
import type { PersonalLedger } from './service.js';

/**
 * Wrap an EscrowStore so RELEASE transitions append personal-ledger rows.
 * EscrowService does not import this module — callers compose store + ledger.
 */
export function listenForReleases(store: EscrowStore, ledger: PersonalLedger): EscrowStore {
  return {
    insertWallet: (wallet) => store.insertWallet(wallet),
    updateWallet: (wallet) => store.updateWallet(wallet),
    getWalletById: (id) => store.getWalletById(id),
    getMasterWallet: (userId) => store.getMasterWallet(userId),
    getGameWallet: (userId, tableId) => store.getGameWallet(userId, tableId),
    listWallets: () => store.listWallets(),
    insertEscrow: (escrow) => store.insertEscrow(escrow),
    updateEscrow: (escrow) => store.updateEscrow(escrow),
    getEscrow: (id) => store.getEscrow(id),
    listEscrows: () => store.listEscrows(),
    listLedger: () => store.listLedger(),
    insertLedger(row) {
      store.insertLedger(row);
      if (row.kind === 'TRANSITION' && row.toState === 'RELEASED' && row.escrowId) {
        const escrow = store.getEscrow(row.escrowId);
        if (escrow?.state === 'RELEASED') {
          ledger.recordRelease(escrow, row.at);
        }
      }
    },
  };
}
