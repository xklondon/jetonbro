import { startNewGame } from "@/application/services/game-session";
import { tableHasLockedValue } from "@/application/services/switch-game-lock";

export async function switchGame(input: {
  actorId: string;
  tableId: string;
  idempotencyKey: string;
  game: string;
  smallBlind?: string;
  bigBlind?: string;
  seatOrder?: string[];
  savePersonalLedger?: boolean | string;
  startingJetonsPerPlayer?: string;
  /** Default false — preserve each player's available balance across the switch. */
  resetBalances?: boolean | string;
  participantUserIds?: string[];
  stakeType?: string;
  currencyCode?: string;
  moneyPerJeton?: string;
  moneyBuyIn?: string;
  customUnitLabel?: string;
  jetonsPerCustomUnit?: string;
  dealerUserId?: string;
}) {
  return startNewGame({
    ...input,
    participantUserIds: input.participantUserIds ?? input.seatOrder,
  });
}

export { tableHasLockedValue };
