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
  available: MoneyView | null;
};

export type InvitationView = {
  id: string;
  kind: "EMAIL" | "QR";
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
};

export type BankPlayerGroupView = {
  userId: string;
  name: string;
  available: MoneyView;
  locked: MoneyView;
  status: string;
  boxes: BoxView[];
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
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  bankroll?: BankrollView;
  dealerHand?: HandView;
  bankLimitReached?: boolean;
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
  bankroll?: BankrollView;
  dealerHand?: HandView;
  dealerName?: string;
  insuranceSuggestion?: "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK" | null;
  canSwitchGame?: boolean;
  switchBlockedReason?: string | null;
  waitingForFirstBet?: boolean;
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
  gameOptions: { id: string; label: string; available: boolean }[];
  ownerName: string;
  bankName: string;
  startingJetonsPerPlayer: MoneyView;
  seats: SetupSeatView[];
  members: MemberView[];
  invitations: InvitationView[];
  joinUrl: string | null;
  minBet: MoneyView | null;
  maxBet: MoneyView | null;
  blackjackPayout: "THREE_TWO" | "SIX_FIVE";
  maxBoxesPerPlayer: number;
  insuranceEnabled: boolean;
  bankMayDistributeJetons: boolean;
  canStartBetting: boolean;
  startBlockedReason: string | null;
  isOwner: boolean;
  setupCompleted: boolean;
  tableStatus: "SETUP" | "ACTIVE" | "ARCHIVED";
  paused: boolean;
  closePreview: CloseTablePreview | null;
  cardAssist?: "OFF" | "CONFIRM" | "AUTO";
  bankFundingMode?: "OPEN" | "LIMITED";
  startingBank?: MoneyView | null;
  canSwitchGame?: boolean;
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
  toCall: MoneyView;
  contribution: MoneyView;
  available: MoneyView;
  smallBlind: MoneyView;
  bigBlind: MoneyView;
  streetWager: MoneyView;
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
  canScheduleNextHand: boolean;
  nextHandDeadlineAt: string | null;
  canSwitchGame: boolean;
  switchBlockedReason: string | null;
  canAddPlayer: boolean;
  canGiveJetons: boolean;
  canReorderSeats: boolean;
  streetComplete: boolean;
  allInRunout: boolean;
  turnNumber: number;
  handNumber: number;
  viewerId: string;
  communityCards: PokerCardView[];
  canEditCommunity: boolean;
  canEditHole: boolean;
  streetRail: PokerStreetRailView[];
};

export type WaitingTableView = {
  role: "WAITING";
  phase: "TABLE_SETUP";
  tableName: string;
  game: string;
  available: MoneyView;
  copy: string;
};

export type ClientSnapshot = {
  tableId: string;
  viewerId: string;
  viewerName: string;
  isOwner: boolean;
  isBank: boolean;
  game: "BLACKJACK" | "POKER";
  gameLabel?: string;
  phase: RoundPhase | string;
  phaseLabel?: string;
  headline?: string;
  revision?: number;
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
};
