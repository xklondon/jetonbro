import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/application/auth";
import { DomainError } from "@/domain/errors";
import {
  abandonDraft,
  assignBankDealer,
  closeTable,
  deleteTable,
  distributeJetons,
  finalizeSetup,
  removeMember,
  saveTable,
  updateTableSettings,
} from "@/application/services/tables";
import { addPlayerManually, inviteByEmail, rotateQrInvitation } from "@/application/services/invitations";
import {
  addBox,
  buyInsurance,
  closeInsurance,
  dealCards,
  scheduleDeal,
  doubleBox,
  enterPayout,
  openInsurance,
  placeOrRetractBet,
  removeBox,
  settleBox,
  settleInsurance,
  splitBox,
  startBetting,
  startNextRound,
  scheduleNextRound,
  mutateCards,
  applyCardOutcome,
  applyInsuranceSuggestion,
  setCardAssist,
  setBankFunding,
} from "@/application/services/blackjack-round";
import { switchGame } from "@/application/services/switch-game";
import {
  advancePokerStreet,
  awardPokerPots,
  configurePoker,
  pokerAct,
  scheduleNextPokerHand,
  setPokerWinners,
  startNextPokerHand,
  startTexasHoldem,
} from "@/application/services/poker-hand";
import { setPokerCommunityCards, setPokerHoleCards } from "@/application/services/poker-cards";
import { BOX_OUTCOMES } from "@/domain/blackjack/payouts";
import { INSURANCE_RESOLUTIONS } from "@/domain/blackjack/payouts";
import { publicOrigin } from "@/application/auth-urls";
import { prisma } from "@/application/db";
import { logCommandFailure } from "@/application/command-log";

const commandSchema = z.object({
  command: z.string(),
  idempotencyKey: z.string().min(8),
}).passthrough();

function originFrom(request: NextRequest): string {
  return publicOrigin(request.nextUrl.origin);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ tableId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { tableId } = await context.params;
  const actorId = session.user.id;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid command." }, { status: 400 });
  }
  const parsed = commandSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid command." }, { status: 400 });
  }
  const { command, idempotencyKey, ...rest } = parsed.data;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  try {
    const result = await dispatch(command, {
      actorId,
      tableId,
      idempotencyKey,
      origin: originFrom(request),
      ip,
      payload: rest,
    });
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    const phase = await prisma.table
      .findUnique({
        where: { id: tableId },
        select: { currentPhase: true, game: true, currentPokerHand: { select: { phase: true } } },
      })
      .then((row) =>
        row?.game === "POKER" ? (row.currentPokerHand?.phase ?? "POKER_SETUP") : row?.currentPhase,
      )
      .catch(() => undefined);
    const code = error instanceof DomainError ? error.code : "UNEXPECTED";
    logCommandFailure({ command, tableId, actorId, phase, code });
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "This action could not be completed." }, { status: 500 });
  }
}

async function dispatch(
  command: string,
  ctx: { actorId: string; tableId: string; idempotencyKey: string; origin: string; ip: string; payload: Record<string, unknown> },
) {
  if (command !== "closeTable" && command !== "deleteTable") {
    const table = await prisma.table.findUnique({ where: { id: ctx.tableId }, select: { status: true } });
    if (table?.status === "ARCHIVED") {
      throw new DomainError("TABLE_CLOSED", "This table is closed.");
    }
  }
  const p = ctx.payload;
  switch (command) {
    case "startBetting":
      return startBetting(ctx);
    case "dealCards":
      return dealCards(ctx);
    case "scheduleDeal":
      return scheduleDeal(ctx);
    case "scheduleNextRound":
      return scheduleNextRound(ctx);
    case "enterPayout":
      return enterPayout(ctx);
    case "startNextRound":
      return startNextRound(ctx);
    case "addBox":
      return addBox(ctx);
    case "removeBox":
      return removeBox({ ...ctx, boxId: String(p.boxId) });
    case "placeBet":
      return placeOrRetractBet({
        ...ctx,
        boxId: String(p.boxId),
        amount: String(p.amount),
        mode: (p.mode as "SET" | "ADD" | "RETRACT") ?? "ADD",
      });
    case "doubleBox":
      return doubleBox({ ...ctx, boxId: String(p.boxId) });
    case "splitBox":
      return splitBox({ ...ctx, boxId: String(p.boxId) });
    case "openInsurance":
      return openInsurance(ctx);
    case "closeInsurance":
      return closeInsurance(ctx);
    case "buyInsurance":
      return buyInsurance({ ...ctx, boxId: String(p.boxId), amount: String(p.amount) });
    case "settleBox": {
      const outcome = BOX_OUTCOMES.find((item) => item === p.outcome);
      if (!outcome) throw new DomainError("INVALID_OUTCOME", "Choose a valid box result.");
      return settleBox({ ...ctx, boxId: String(p.boxId), outcome });
    }
    case "settleInsurance": {
      const resolution = INSURANCE_RESOLUTIONS.find((item) => item === p.resolution);
      if (!resolution) throw new DomainError("INVALID_RESOLUTION", "Choose a valid Insurance result.");
      return settleInsurance({ ...ctx, resolution });
    }
    case "finalizeSetup":
      return finalizeSetup({
        ...ctx,
        name: String(p.name ?? ""),
        startingJetonsPerPlayer: p.startingJetonsPerPlayer ? String(p.startingJetonsPerPlayer) : undefined,
        emails: String(p.emails ?? "")
          .split(/[,\s]+/)
          .filter(Boolean),
        cardAssist: p.cardAssist ? String(p.cardAssist) : undefined,
        bankFundingMode: p.bankFundingMode ? String(p.bankFundingMode) : undefined,
        startingBank: p.startingBank ? String(p.startingBank) : undefined,
        game: p.game ? String(p.game) : undefined,
        smallBlind: p.smallBlind ? String(p.smallBlind) : undefined,
        bigBlind: p.bigBlind ? String(p.bigBlind) : undefined,
        seatOrder: typeof p.seatOrder === "string" ? p.seatOrder.split(",").filter(Boolean) : undefined,
      });
    case "abandonDraft":
      return abandonDraft(ctx);
    case "inviteByEmail":
      return inviteByEmail({
        ...ctx,
        emails: String(p.emails ?? "")
          .split(/[,\s]+/)
          .filter(Boolean),
      });
    case "rotateQr":
      return rotateQrInvitation({ ...ctx, disable: Boolean(p.disable) });
    case "addPlayer":
      return addPlayerManually({
        ...ctx,
        email: String(p.email ?? ""),
        name: p.name ? String(p.name) : undefined,
      });
    case "giveJetons":
      return distributeJetons({
        ...ctx,
        userId: String(p.userId),
        amount: String(p.amount),
      });
    case "assignBank":
      return assignBankDealer({ ...ctx, userId: String(p.userId) });
    case "removePlayer":
      return removeMember({ ...ctx, userId: String(p.userId) });
    case "updateSettings":
      return updateTableSettings({
        ...ctx,
        minBet: p.minBet ? String(p.minBet) : undefined,
        maxBet: p.maxBet ? String(p.maxBet) : undefined,
        blackjackPayout: p.blackjackPayout === "SIX_FIVE" ? "SIX_FIVE" : "THREE_TWO",
        maxBoxesPerPlayer: p.maxBoxesPerPlayer === undefined ? undefined : String(p.maxBoxesPerPlayer),
        insuranceEnabled: p.insuranceEnabled === undefined ? undefined : p.insuranceEnabled === true || p.insuranceEnabled === "true",
        bankMayDistributeJetons: p.bankMayDistributeJetons === undefined ? undefined : Boolean(p.bankMayDistributeJetons),
        game: p.game ? String(p.game) : undefined,
        cardAssist: p.cardAssist ? String(p.cardAssist) : undefined,
        bankFundingMode: p.bankFundingMode ? String(p.bankFundingMode) : undefined,
        startingBank: p.startingBank ? String(p.startingBank) : undefined,
      });
    case "addCard":
      return mutateCards({
        ...ctx,
        boxId: p.boxId ? String(p.boxId) : undefined,
        dealer: p.dealer === true || p.dealer === "true",
        action: "ADD",
        rank: String(p.rank ?? ""),
      });
    case "removeCard":
      return mutateCards({
        ...ctx,
        boxId: p.boxId ? String(p.boxId) : undefined,
        dealer: p.dealer === true || p.dealer === "true",
        action: "REMOVE",
        index: p.index === undefined ? undefined : String(p.index),
      });
    case "completeHand":
      return mutateCards({
        ...ctx,
        boxId: p.boxId ? String(p.boxId) : undefined,
        dealer: p.dealer === true || p.dealer === "true",
        action: "COMPLETE",
      });
    case "reopenHand":
      return mutateCards({
        ...ctx,
        boxId: p.boxId ? String(p.boxId) : undefined,
        dealer: p.dealer === true || p.dealer === "true",
        action: "REOPEN",
      });
    case "clearHand":
      return mutateCards({
        ...ctx,
        boxId: p.boxId ? String(p.boxId) : undefined,
        dealer: p.dealer === true || p.dealer === "true",
        action: "CLEAR",
      });
    case "applyCardOutcome":
      return applyCardOutcome({ ...ctx, boxId: String(p.boxId) });
    case "applyInsuranceSuggestion":
      return applyInsuranceSuggestion(ctx);
    case "setCardAssist":
      return setCardAssist({ ...ctx, cardAssist: String(p.cardAssist ?? "") });
    case "setBankFunding":
      return setBankFunding({
        ...ctx,
        bankFundingMode: String(p.bankFundingMode ?? ""),
        startingBank: p.startingBank ? String(p.startingBank) : undefined,
      });
    case "switchGame":
      return switchGame({
        ...ctx,
        game: String(p.game ?? ""),
        smallBlind: p.smallBlind ? String(p.smallBlind) : undefined,
        bigBlind: p.bigBlind ? String(p.bigBlind) : undefined,
        seatOrder: typeof p.seatOrder === "string" ? p.seatOrder.split(",").filter(Boolean) : undefined,
      });
    case "configurePoker":
      return configurePoker({
        ...ctx,
        smallBlind: p.smallBlind ? String(p.smallBlind) : undefined,
        bigBlind: p.bigBlind ? String(p.bigBlind) : undefined,
        seatOrder: typeof p.seatOrder === "string" ? p.seatOrder.split(",") : undefined,
      });
    case "startTexasHoldem":
      return startTexasHoldem({
        ...ctx,
        smallBlind: p.smallBlind ? String(p.smallBlind) : undefined,
        bigBlind: p.bigBlind ? String(p.bigBlind) : undefined,
        seatOrder: typeof p.seatOrder === "string" ? p.seatOrder.split(",") : undefined,
      });
    case "pokerAct":
      return pokerAct({
        ...ctx,
        type: String(p.type ?? "") as "FOLD" | "CHECK" | "CALL" | "BET" | "RAISE" | "ALL_IN",
        amount: p.amount ? String(p.amount) : undefined,
      });
    case "advancePokerStreet":
      return advancePokerStreet(ctx);
    case "setPokerCommunityCards":
      return setPokerCommunityCards({
        ...ctx,
        cards: p.cards ? JSON.parse(String(p.cards)) : [],
      });
    case "setPokerHoleCards":
      return setPokerHoleCards({
        ...ctx,
        cards: p.cards ? JSON.parse(String(p.cards)) : [],
      });
    case "setPokerWinners":
      return setPokerWinners({
        ...ctx,
        pots: JSON.parse(String(p.pots ?? "[]")) as { index: number; winnerIds: string[] }[],
      });
    case "awardPokerPots":
      return awardPokerPots({
        ...ctx,
        pots: p.pots ? (JSON.parse(String(p.pots)) as { index: number; winnerIds: string[] }[]) : undefined,
      });
    case "startNextPokerHand":
      return startNextPokerHand(ctx);
    case "scheduleNextPokerHand":
      return scheduleNextPokerHand(ctx);
    case "saveTable":
      return saveTable(ctx);
    case "closeTable":
      return closeTable(ctx);
    case "deleteTable":
      return deleteTable(ctx);
    default:
      throw new DomainError("UNKNOWN_COMMAND", "Unknown table command.");
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST." }, { status: 405 });
}
