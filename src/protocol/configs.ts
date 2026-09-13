import type { ProtocolConfig } from './types.js';

export const BLACKJACK_PROTOCOL: ProtocolConfig = {
  id: 'blackjack',
  authorityMode: 'standing',
  authorityModeEditable: true,
  turnEnforcement: 'display-only',
  payoutRule: 'multiplier',
  multipliers: { win: 2, blackjack: 2.5, push: 1, lose: 0 },
  phases: ['setup', 'betting-open', 'betting-closed', 'post-deal', 'resolution', 'new-round'],
  actions: [
    { id: 'assign-chips', phase: 'setup', role: 'bank' },
    { id: 'top-up', phase: 'setup', role: 'bank' },
    { id: 'open-betting', phase: 'setup', role: 'bank', nextPhase: 'betting-open' },
    { id: 'bet', phase: 'betting-open', role: 'player' },
    { id: 'close-betting', phase: 'betting-open', role: 'bank', nextPhase: 'betting-closed' },
    { id: 'signal-cards-dealt', phase: 'betting-closed', role: 'bank', nextPhase: 'post-deal' },
    { id: 'open-insurance-window', phase: 'post-deal', role: 'bank', setFlags: { insuranceWindow: true } },
    { id: 'double', phase: 'post-deal', role: 'player' },
    { id: 'split', phase: 'post-deal', role: 'player' },
    { id: 'insurance', phase: 'post-deal', role: 'player', requiresFlag: 'insuranceWindow' },
    { id: 'begin-resolution', phase: 'post-deal', role: 'bank', nextPhase: 'resolution' },
    { id: 'declare-outcome', phase: 'resolution', role: 'bank' },
    { id: 'attach-hand-display', phase: 'resolution', role: 'player' },
    { id: 'finish-resolution', phase: 'resolution', role: 'bank', nextPhase: 'new-round' },
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
  turnEnforcement: 'required',
  payoutRule: 'even-split',
  phases: ['setup', 'hand-start', 'betting-round', 'showdown', 'new-hand'],
  actions: [
    { id: 'start-hand', phase: 'setup', role: 'dealer', nextPhase: 'hand-start' },
    { id: 'confirm-blind', phase: 'hand-start', role: 'player', advanceTurn: true },
    { id: 'begin-betting', phase: 'hand-start', role: 'dealer', nextPhase: 'betting-round' },
    { id: 'bet', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'call', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'raise', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'check', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'fold', phase: 'betting-round', role: 'player', advanceTurn: true },
    { id: 'advance-betting-round', phase: 'betting-round', role: 'dealer' },
    { id: 'begin-showdown', phase: 'betting-round', role: 'dealer', nextPhase: 'showdown' },
    { id: 'declare-winners', phase: 'showdown', role: 'dealer' },
    { id: 'attach-hand-display', phase: 'showdown', role: 'player', ignoreTurn: true },
    { id: 'finish-showdown', phase: 'showdown', role: 'dealer', nextPhase: 'new-hand' },
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
  turnEnforcement: 'required',
  payoutRule: 'even-split',
  phases: ['setup', 'turn-start', 'turn-resolution', 'next-turn'],
  actions: [
    { id: 'start-turn', phase: 'setup', role: 'turn-holder', nextPhase: 'turn-start' },
    { id: 'stake', phase: 'turn-start', role: 'turn-holder' },
    { id: 'begin-resolution', phase: 'turn-start', role: 'turn-holder', nextPhase: 'turn-resolution' },
    { id: 'declare-outcome', phase: 'turn-resolution', role: 'turn-holder' },
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
