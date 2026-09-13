import type { Escrow } from '../escrow/types.js';

export interface DerivedTransfer {
  from: string;
  to: string;
  amount: number;
}

/** Turn a RELEASED escrow into pairwise transfers (A→B chip movements). */
export function transfersFromRelease(escrow: Escrow): DerivedTransfer[] {
  if (escrow.state !== 'RELEASED' || !escrow.payout) {
    return [];
  }

  const contributed = new Map<string, number>();
  add(contributed, escrow.userId, escrow.amount);

  const received = new Map<string, number>();
  let creditTotal = 0;
  for (const credit of escrow.payout.credits) {
    creditTotal += credit.amount;
    add(received, credit.userId, credit.amount);
  }

  const extra = creditTotal - escrow.amount;
  if (escrow.payout.counterpartyUserId) {
    if (extra > 0) {
      add(contributed, escrow.payout.counterpartyUserId, extra);
    } else if (extra < 0) {
      add(received, escrow.payout.counterpartyUserId, -extra);
    }
  }

  const nets = new Map<string, number>();
  for (const userId of new Set([...contributed.keys(), ...received.keys()])) {
    const net = (received.get(userId) ?? 0) - (contributed.get(userId) ?? 0);
    if (net !== 0) {
      nets.set(userId, net);
    }
  }

  return pairNets(nets);
}

function add(map: Map<string, number>, userId: string, amount: number): void {
  map.set(userId, (map.get(userId) ?? 0) + amount);
}

function pairNets(nets: Map<string, number>): DerivedTransfer[] {
  const debtors: { userId: string; amount: number }[] = [];
  const creditors: { userId: string; amount: number }[] = [];
  for (const [userId, net] of nets) {
    if (net < 0) {
      debtors.push({ userId, amount: -net });
    } else if (net > 0) {
      creditors.push({ userId, amount: net });
    }
  }

  const transfers: DerivedTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i]!;
    const creditor = creditors[j]!;
    const amount = Math.min(debtor.amount, creditor.amount);
    if (amount > 0) {
      transfers.push({ from: debtor.userId, to: creditor.userId, amount });
    }
    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) {
      i += 1;
    }
    if (creditor.amount === 0) {
      j += 1;
    }
  }
  return transfers;
}
