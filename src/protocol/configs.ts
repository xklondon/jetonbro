import type { ProtocolConfig } from './types.js';

export const BLACKJACK_PROTOCOL: ProtocolConfig = {
  id: 'blackjack',
  authorityMode: 'standing',
  authorityModeEditable: true,
  authorityRole: 'bank',
  turnEnforcement: 'display-only',
  payoutRule: 'multiplier',
  multipliers: { win: 2, blackjack: 2.5, push: 1, lose: 0 },
  phases: ['setup', 'betting-open', 'betting-closed', 'post-deal', 'resolution', 'new-round'],
  actions: [
    { id: 'assign-bank', phase: 'setup', role: 'table-owner', assignsAuthority: true, label: 'Assign bank' },
    {
      id: 'open-betting',
      phase: 'setup',
      role: 'bank',
      nextPhase: 'betting-open',
      requiresNonAuthorityPlayer: true,
      label: 'Start betting',
    },
    { id: 'bet', phase: 'betting-open', role: 'player', createsOwnedBox: true, locksChips: true },
    { id: 'close-betting', phase: 'betting-open', role: 'bank', nextPhase: 'betting-closed', locksAllBoxes: true },
    { id: 'signal-cards-dealt', phase: 'betting-closed', role: 'bank', nextPhase: 'post-deal' },
    { id: 'open-insurance-window', phase: 'post-deal', role: 'bank', setFlags: { insuranceWindow: true } },
    { id: 'double', phase: 'post-deal', role: 'player', requiresOwnedBox: true, addsToOwnedBox: true, locksChips: true },
    { id: 'split', phase: 'post-deal', role: 'player', requiresOwnedBox: true, splitsOwnedBox: true, locksChips: true },
    {
      id: 'insurance',
      phase: 'post-deal',
      role: 'player',
      requiresFlag: 'insuranceWindow',
      requiresOwnedBox: true,
      addsToOwnedBox: true,
      locksChips: true,
    },
    { id: 'begin-resolution', phase: 'post-deal', role: 'bank', nextPhase: 'resolution' },
    {
      id: 'declare-outcome',
      phase: 'resolution',
      role: 'bank',
      requiresBox: true,
      resolvesBox: true,
      resolvesPot: true,
      releasesBox: true,
      label: 'Confirm box',
    },
    { id: 'attach-hand-display', phase: 'resolution', role: 'player' },
    { id: 'finish-resolution', phase: 'resolution', role: 'bank', nextPhase: 'new-round', releasesPot: true },
    {
      id: 'reopen-betting',
      phase: 'new-round',
      role: 'bank',
      nextPhase: 'betting-open',
      rotateAuthority: true,
      afterRotateTurn: 'first',
    },
  ],
};

export const POKER_PROTOCOL: ProtocolConfig = {
  id: 'poker',
  authorityMode: 'rotating',
  authorityModeEditable: false,
  authorityRole: 'dealer',
  turnEnforcement: 'required',
  payoutRule: 'even-split',
  phases: ['setup', 'hand-start', 'betting-round', 'showdown', 'new-hand'],
  actions: [
    { id: 'start-hand', phase: 'setup', role: 'dealer', nextPhase: 'hand-start' },
    { id: 'confirm-blind', phase: 'hand-start', role: 'player', advanceTurn: true, locksChips: true },
    { id: 'begin-betting', phase: 'hand-start', role: 'dealer', nextPhase: 'betting-round' },
    { id: 'bet', phase: 'betting-round', role: 'player', advanceTurn: true, locksChips: true },
    { id: 'call', phase: 'betting-round', role: 'player', advanceTurn: true, locksChips: true },
    { id: 'raise', phase: 'betting-round', role: 'player', advanceTurn: true, locksChips: true },
    { id: 'check', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'fold', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'advance-betting-round', phase: 'betting-round', role: 'dealer' },
    { id: 'begin-showdown', phase: 'betting-round', role: 'dealer', nextPhase: 'showdown' },
    { id: 'declare-winners', phase: 'showdown', role: 'dealer', resolvesPot: true },
    { id: 'attach-hand-display', phase: 'showdown', role: 'player', ignoreTurn: true },
    { id: 'finish-showdown', phase: 'showdown', role: 'dealer', nextPhase: 'new-hand', releasesPot: true },
    {
      id: 'new-hand',
      phase: 'new-hand',
      role: 'dealer',
      nextPhase: 'hand-start',
      rotateAuthority: true,
      afterRotateTurn: 'next-after-authority',
    },
  ],
};

export const ZILCH_PROTOCOL: ProtocolConfig = {
  id: 'zilch',
  authorityMode: 'rotating',
  authorityModeEditable: false,
  authorityRole: 'turn-holder',
  turnEnforcement: 'required',
  payoutRule: 'even-split',
  phases: ['setup', 'turn-start', 'turn-resolution', 'next-turn'],
  actions: [
    { id: 'start-turn', phase: 'setup', role: 'turn-holder', nextPhase: 'turn-start' },
    { id: 'stake', phase: 'turn-start', role: 'turn-holder', locksChips: true },
    { id: 'begin-resolution', phase: 'turn-start', role: 'turn-holder', nextPhase: 'turn-resolution' },
    { id: 'declare-outcome', phase: 'turn-resolution', role: 'turn-holder', resolvesPot: true, releasesPot: true },
    {
      id: 'next-turn',
      phase: 'turn-resolution',
      role: 'turn-holder',
      nextPhase: 'turn-start',
      rotateAuthority: true,
      afterRotateTurn: 'authority',
    },
  ],
};

export const PROTOCOLS: Record<ProtocolConfig['id'], ProtocolConfig> = {
  blackjack: BLACKJACK_PROTOCOL,
  poker: POKER_PROTOCOL,
  zilch: ZILCH_PROTOCOL,
};

export function getProtocol(id: ProtocolConfig['id']): ProtocolConfig {
  return PROTOCOLS[id];
}
