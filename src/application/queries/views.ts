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
  payoutActions: PayoutActionView[];
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

export type BankPermittedActions = {
  dealCards: boolean;
  scheduleDeal: boolean;
  payoutPhase: boolean;
  nextHand: boolean;
  openInsurance: boolean;
  closeInsurance: boolean;
  settleBoxes: boolean;
  settleInsurance: boolean;
  addPlayer: boolean;
  giveJetons: boolean;
  changeBank: boolean;
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
  playerCount: number;
  boxCount: number;
  lockedOrdinary: MoneyView;
  insurance: InsurancePotView;
  actions: BankPermittedActions;
  insuranceSettleActions: { id: InsurancePotView["window"] extends never ? never : string; label: string }[];
  bettingCloseDeadlineAt: string | null;
  hasValidBet: boolean;
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
  members: MemberView[];
  setup: SetupTableView | null;
  waiting: WaitingTableView | null;
  player: PlayerTableView | null;
  bank: BankTableView | null;
};
