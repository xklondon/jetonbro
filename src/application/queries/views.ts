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
  settleInsurance: boolean;
  addPlayer: boolean;
  giveJetons: boolean;
  changeBank: boolean;
  saveTable: boolean;
  closeTable: boolean;
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
  insuranceSuggestion?: "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK" | null;
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
  phase: RoundPhase;
  revision?: number;
  roundNumber?: number;
  roundId?: string | null;
  tableClosed: boolean;
  members: MemberView[];
  setup: SetupTableView | null;
  waiting: WaitingTableView | null;
  player: PlayerTableView | null;
  bank: BankTableView | null;
};
