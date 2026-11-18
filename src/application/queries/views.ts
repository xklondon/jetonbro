import type { RoundPhase } from "@/domain/blackjack/phases";
import type { BoxOutcome } from "@/domain/blackjack/payouts";

export type MoneyView = {
  millis: string;
  label: string;
};

export type ChipView = {
  denomination: string;
  className: "c5" | "c10" | "c25" | "c50";
};

export type PayoutActionView = {
  outcome: BoxOutcome;
  label: string;
  title?: string;
  returnLine?: string;
  swipeLabel?: string;
};

export type HandView = {
  ranks: string[];
  complete: boolean;
  label: string;
  suggestedOutcome: BoxOutcome | null;
  suggestedInsurance?: "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK" | null;
  canEdit: boolean;
};

export type BankrollView = {
  mode: "OPEN" | "LIMITED";
  available: MoneyView;
  reserved: MoneyView;
  total: MoneyView;
  canToggle: boolean;
  lockedReason: string | null;
  canCoverMore: boolean;
};

export type BoxView = {
  id: string;
  playerId: string;
  playerName: string;
  label: string;
  boxNumber: number;
  /** Set when this box was created by SPLIT from another box. */
  parentBoxId?: string | null;
  bet: MoneyView;
  originalStake: MoneyView;
  isDoubled: boolean;
  isSplit: boolean;
  insurance: MoneyView | null;
  insuranceMax: MoneyView;
  insuranceResult: string | null;
  outcome: BoxOutcome | null;
  returned: MoneyView | null;
  settledKey?: string | null;
  /** Confirmed next-round stake prepared during PAYOUT / ROUND_COMPLETE. */
  nextRoundBet?: MoneyView | null;
  payoutActions: PayoutActionView[];
  hand?: HandView;
  coverage?: { bet: boolean; double: boolean; split: boolean; insurance: boolean };
};

export type MemberView = {
  userId: string;
  name: string;
  email: string;
  isOwner: boolean;
  isBankDealer: boolean;
  isGuest?: boolean;
  available: MoneyView | null;
};

export type InvitationView = {
  id: string;
  kind: "EMAIL" | "QR" | "GUEST";
  email: string | null;
  pending: boolean;
};

export type InsurancePotView = {
  window: "CLOSED" | "OPEN" | "SETTLED";
  total: MoneyView;
  count: number;
  resolution: string | null;
};

export type PlayerPermittedActions = {
  bet: boolean;
  retract: boolean;
  addBox: boolean;
  removeEmptyBox: boolean;
  double: boolean;
  split: boolean;
  insurance: boolean;
  /** Prepare confirmed stakes for the next round during PAYOUT / ROUND_COMPLETE. */
  nextRoundBet?: boolean;
  /** Owner-only management (independent of dealer assignment). */
  addPlayer?: boolean;
  giveJetons?: boolean;
  changeBank?: boolean;
  switchGame?: boolean;
  leaveTable?: boolean;
};

export type BankPlayerGroupView = {
  userId: string;
  name: string;
  available: MoneyView;
  locked: MoneyView;
  status: string;
  boxes: BoxView[];
};

export type GameSessionView = {
  id: string;
  gameType: "BLACKJACK" | "POKER";
  status: string;
  startedAt: string;
  startingJetons: MoneyView;
  stakeType: "FUN_ONLY" | "MONEY" | "CUSTOM";
  stakeExample: string;
  players: { userId: string; name: string; available: MoneyView; isOwner: boolean; isDealer: boolean }[];
};

export type CloseTablePreview = {
  confirmation: string;
  players: { userId: string; name: string; available: MoneyView; locked: MoneyView }[];
};

export type BankPermittedActions = {
  dealCards: boolean;
  scheduleDeal: boolean;
  payoutPhase: boolean;
  nextHand: boolean;
  scheduleNextRound: boolean;
  openInsurance: boolean;
  closeInsurance: boolean;
  settleBoxes: boolean;
  settleDealerWon: boolean;
  settleInsurance: boolean;
  addPlayer: boolean;
  giveJetons: boolean;
  changeBank: boolean;
  saveTable: boolean;
  closeTable: boolean;
  switchGame: boolean;
  leaveTable?: boolean;
};

export type OutcomeFxView = {
  enabled: boolean;
  frequency: "off" | "occasional" | "often" | "always";
};

export type PlayerTableView = {
  role: "PLAYER";
  phase: RoundPhase;
  tableName: string;
  title: string;
  copy: string;
  available: MoneyView;
  boxes: BoxView[];
  actions: PlayerPermittedActions;
  insuranceWindowOpen: boolean;
  bettingCloseDeadlineAt: string | null;
  nextRoundDeadlineAt: string | null;
  /** Table minimum bet (for ALL IN short-stack UX and tray hints). */
  minBet?: MoneyView | null;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  outcomeFx?: OutcomeFxView;
  bankroll?: BankrollView;
  dealerHand?: HandView;
  bankLimitReached?: boolean;
  isOwner?: boolean;
  canSwitchGame?: boolean;
  canLeaveTable?: boolean;
  switchBlockedReason?: string | null;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  invitations?: InvitationView[];
  emailConfigured?: boolean;
  startingJetons?: MoneyView;
  closePreview?: CloseTablePreview | null;
  gameSession?: GameSessionView | null;
};

export type BankTableView = {
  role: "BANK";
  phase: RoundPhase;
  tableName: string;
  title: string;
  copy: string;
  phaseLabel: string;
  primaryAction: { id: "dealCards" | "payoutPhase" | "nextHand" | "settleAll"; label: string; enabled: boolean };
  boxes: BoxView[];
  players: BankPlayerGroupView[];
  playerCount: number;
  boxCount: number;
  lockedOrdinary: MoneyView;
  insurance: InsurancePotView;
  actions: BankPermittedActions;
  insuranceSettleActions: { id: InsurancePotView["window"] extends never ? never : string; label: string }[];
  bettingCloseDeadlineAt: string | null;
  nextRoundDeadlineAt: string | null;
  hasValidBet: boolean;
  isOwner: boolean;
  tableStatus: "SETUP" | "ACTIVE" | "ARCHIVED";
  paused: boolean;
  closePreview: CloseTablePreview | null;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  outcomeFx?: OutcomeFxView;
  bankroll?: BankrollView;
  dealerHand?: HandView;
  dealerName?: string;
  insuranceSuggestion?: "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK" | null;
  canSwitchGame?: boolean;
  switchBlockedReason?: string | null;
  waitingForFirstBet?: boolean;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  invitations?: InvitationView[];
  emailConfigured?: boolean;
  startingJetons?: MoneyView;
  gameSession?: GameSessionView | null;
  /** TABLE_SETUP only — drives START BETTING dock legality. */
  canStartBetting?: boolean;
};

export type SetupSeatStatus = "Bank / Dealer" | "Invited" | "Joined" | "Ready";

export type SetupSeatView = {
  id: string;
  name: string;
  status: SetupSeatStatus;
};

export type SetupTableView = {
  role: "SETUP";
  phase: "TABLE_SETUP";
  tableName: string;
  game: string;
  gameId?: "BLACKJACK" | "POKER";
  gameOptions: { id: string; label: string; available: boolean }[];
  ownerName: string;
  bankName: string;
  startingJetonsPerPlayer: MoneyView;
  seats: SetupSeatView[];
  members: MemberView[];
  invitations: InvitationView[];
  joinUrl: string | null;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  minBet: MoneyView | null;
  maxBet: MoneyView | null;
  blackjackPayout: "THREE_TWO" | "SIX_FIVE";
  maxBoxesPerPlayer: number;
  insuranceEnabled: boolean;
  bankMayDistributeJetons: boolean;
  canStartBetting: boolean;
  startBlockedReason: string | null;
  isOwner: boolean;
  isBank?: boolean;
  setupCompleted: boolean;
  tableStatus: "SETUP" | "ACTIVE" | "ARCHIVED";
  paused: boolean;
  closePreview: CloseTablePreview | null;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  outcomeFx?: OutcomeFxView;
  bankFundingMode?: "OPEN" | "LIMITED";
  startingBank?: MoneyView | null;
  canSwitchGame?: boolean;
  emailConfigured?: boolean;
  gameSession?: GameSessionView | null;
};

export type PokerLegalActionView = {
  type: "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN";
  amount: MoneyView;
  raiseTo?: MoneyView;
  label: string;
};

export type PokerCardView = {
  rank: string;
  suit: string;
  label: string;
};

export type PokerStreetRailView = {
  id: string;
  state: "done" | "current" | "next";
};

export type PokerSeatView = {
  userId: string;
  name: string;
  available: MoneyView;
  contribution: MoneyView;
  streetContribution: MoneyView;
  toCall: MoneyView;
  status: "ACTIVE" | "FOLDED" | "ALL_IN" | "WAITING";
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isActor: boolean;
  sittingOut: boolean;
  orderIndex: number;
  hasHoleCards: boolean;
  holeCards: PokerCardView[] | null;
  streetAction?: string | null;
};

export type PokerPotView = {
  index: number;
  amount: MoneyView;
  cap: MoneyView;
  eligiblePlayerIds: string[];
  winnerPlayerIds: string[];
};

export type PokerTableView = {
  role: "POKER_DEALER" | "POKER_PLAYER";
  phase: string;
  phaseLabel: string;
  headline: string;
  tableName: string;
  copy: string;
  isOwner: boolean;
  pot: MoneyView;
  potPaid: boolean;
  toCall: MoneyView;
  contribution: MoneyView;
  available: MoneyView;
  smallBlind: MoneyView;
  bigBlind: MoneyView;
  streetWager: MoneyView;
  /** Last full bet/raise increment for this street (BB at street start). */
  lastRaiseSize?: MoneyView;
  /** Authoritative minimum raise-to = streetWager + lastRaiseSize. */
  minRaiseTo?: MoneyView;
  viewerStatus: "ACTIVE" | "FOLDED" | "ALL_IN" | "WAITING";
  seats: PokerSeatView[];
  pots: PokerPotView[];
  legalActions: PokerLegalActionView[];
  currentActorName: string | null;
  currentActorId: string | null;
  waitingCopy: string | null;
  winners: { userId: string; name: string; amount: MoneyView }[];
  canDealStreet: boolean;
  nextStreetLabel: string | null;
  canAward: boolean;
  canNextHand: boolean;
  /** Authorized player for START HAND after a completed hand (next dealer). */
  nextDealerPlayerId?: string | null;
  canScheduleNextHand: boolean;
  nextHandDeadlineAt: string | null;
  canSwitchGame: boolean;
  switchBlockedReason: string | null;
  canAddPlayer: boolean;
  canGiveJetons: boolean;
  canReorderSeats: boolean;
  /** Owner or Bank/Dealer may edit blinds between hands. */
  canEditBlinds: boolean;
  streetComplete: boolean;
  allInRunout: boolean;
  turnNumber: number;
  handNumber: number;
  viewerId: string;
  communityCards: PokerCardView[];
  canEditCommunity: boolean;
  canEditHole: boolean;
  /** EXIT TABLE between hands (not during an open hand). Owner must close instead. */
  canLeaveTable: boolean;
  streetRail: PokerStreetRailView[];
  gameSession?: GameSessionView | null;
  outcomeFx?: OutcomeFxView;
};

export type WaitingTableView = {
  role: "WAITING";
  phase: "TABLE_SETUP";
  tableName: string;
  game: string;
  gameId?: "BLACKJACK" | "POKER";
  available: MoneyView;
  copy: string;
  bankName?: string;
  ownerName?: string;
  startingJetons?: MoneyView;
  members?: MemberView[];
};

export type ClientSnapshot = {
  tableId: string;
  viewerId: string;
  viewerName: string;
  isOwner: boolean;
  isBank: boolean;
  isDealer?: boolean;
  isSeatedPlayer?: boolean;
  isGuest?: boolean;
  game: "BLACKJACK" | "POKER";
  gameLabel?: string;
  phase: RoundPhase | string;
  phaseLabel?: string;
  headline?: string;
  revision?: number;
  seatedPlayerCount?: number;
  canStartBetting?: boolean;
  roundNumber?: number;
  turnNumber?: number;
  roundId?: string | null;
  tableClosed: boolean;
  members: MemberView[];
  setup: SetupTableView | null;
  waiting: WaitingTableView | null;
  player: PlayerTableView | null;
  bank: BankTableView | null;
  poker: PokerTableView | null;
  gameSession?: GameSessionView | null;
};
