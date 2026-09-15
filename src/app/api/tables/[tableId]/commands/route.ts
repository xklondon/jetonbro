import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/application/auth";
import { DomainError } from "@/domain/errors";
import { assignBankDealer, distributeJetons, removeMember, updateTableSettings } from "@/application/services/tables";
import { addPlayerManually, inviteByEmail, rotateQrInvitation } from "@/application/services/invitations";
import {
  addBox,
  buyInsurance,
  closeInsurance,
  dealCards,
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
} from "@/application/services/blackjack-round";
import { BOX_OUTCOMES } from "@/domain/blackjack/payouts";
import { INSURANCE_RESOLUTIONS } from "@/domain/blackjack/payouts";
import { publicOrigin } from "@/application/auth-urls";

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
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error(error);
    return NextResponse.json({ error: "The table could not complete that action." }, { status: 500 });
  }
}

async function dispatch(
  command: string,
  ctx: { actorId: string; tableId: string; idempotencyKey: string; origin: string; ip: string; payload: Record<string, unknown> },
) {
  const p = ctx.payload;
  switch (command) {
    case "startBetting":
      return startBetting(ctx);
    case "dealCards":
      return dealCards(ctx);
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
      });
    default:
      throw new DomainError("UNKNOWN_COMMAND", "Unknown table command.");
  }
}

export async function GET() {
  return NextResponse.json({ error: "Use POST." }, { status: 405 });
}
