import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/application/auth";
import { DomainError } from "@/domain/errors";
import { createTable, ensureDraftTable } from "@/application/services/tables";
import { publicOrigin } from "@/application/auth-urls";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";

const schema = z.object({
  name: z.string().min(1).optional(),
  draft: z.boolean().optional(),
  game: z.string().optional(),
  startingAllocation: z.string().optional(),
  startingJetonsPerPlayer: z.string().optional(),
  emails: z.array(z.string()).optional(),
  minBet: z.string().optional(),
  maxBet: z.string().optional(),
  blackjackPayout: z.enum(["THREE_TWO", "SIX_FIVE"]).optional(),
  maxBoxesPerPlayer: z.number().int().min(1).max(8).optional(),
  insuranceEnabled: z.boolean().optional(),
  bankMayDistributeJetons: z.boolean().optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const body = schema.parse(await request.json());
    if (body.draft) {
      const result = await ensureDraftTable({
        actorId: session.user.id,
        name: body.name,
      });
      return NextResponse.json(result);
    }
    if (!body.name) {
      return NextResponse.json({ error: "A table name is required." }, { status: 400 });
    }
    const result = await createTable({
      actorId: session.user.id,
      name: body.name,
      game: body.game,
      startingJetonsPerPlayer: body.startingJetonsPerPlayer ?? body.startingAllocation ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
      emails: body.emails,
      origin: publicOrigin(),
      minBet: body.minBet,
      maxBet: body.maxBet,
      blackjackPayout: body.blackjackPayout ?? BLACKJACK_TABLE_DEFAULTS.blackjackPayout,
      maxBoxesPerPlayer: body.maxBoxesPerPlayer ?? BLACKJACK_TABLE_DEFAULTS.maxBoxesPerPlayer,
      insuranceEnabled: body.insuranceEnabled ?? BLACKJACK_TABLE_DEFAULTS.insuranceEnabled,
      bankMayDistributeJetons: body.bankMayDistributeJetons,
      idempotencyKey: body.idempotencyKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Check the table details and try again." }, { status: 400 });
    }
    console.error("[jetonbro-command] command=createTable table=new actor=" + session.user.id + " phase=TABLE_SETUP code=UNEXPECTED");
    return NextResponse.json({ error: "Could not create the table." }, { status: 500 });
  }
}
