import type { PersonalLedgerEntry, Standing } from './types.js';

export function netStanding(entries: PersonalLedgerEntry[], userA: string, userB: string): Standing {
  if (userA === userB) {
    return { status: 'settled' };
  }

  let releaseBA = 0;
  let releaseAB = 0;
  let settleAB = 0;
  let settleBA = 0;

  for (const entry of entries) {
    const involves =
      (entry.from === userA && entry.to === userB) || (entry.from === userB && entry.to === userA);
    if (!involves) {
      continue;
    }
    if (entry.kind === 'RELEASE') {
      if (entry.from === userB && entry.to === userA) {
        releaseBA += entry.amount;
      } else {
        releaseAB += entry.amount;
      }
    } else {
      if (entry.from === userA && entry.to === userB) {
        settleAB += entry.amount;
      } else {
        settleBA += entry.amount;
      }
    }
  }

  // netA = RELEASE(B→A) − RELEASE(A→B) + SETTLEMENT(A→B) − SETTLEMENT(B→A)
  const netA = releaseBA - releaseAB + settleAB - settleBA;
  if (netA > 0) {
    return { status: 'owes', owes: userB, amount: netA };
  }
  if (netA < 0) {
    return { status: 'owes', owes: userA, amount: -netA };
  }
  return { status: 'settled' };
}

export function counterparties(entries: PersonalLedgerEntry[], userId: string): string[] {
  const others = new Set<string>();
  for (const entry of entries) {
    if (entry.from === userId) {
      others.add(entry.to);
    } else if (entry.to === userId) {
      others.add(entry.from);
    }
  }
  return [...others].sort();
}
