import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/application/auth";
import { DomainError } from "@/domain/errors";
import { createTable } from "@/application/services/tables";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";

const schema = z.object({
  name: z.string().min(1),
  game: z.string().optional(),
  startingAllocation: z.string().optional(),
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
    const result = await createTable({
      actorId: session.user.id,
      name: body.name,
      game: body.game,
      startingAllocation: body.startingAllocation ?? BLACKJACK_TABLE_DEFAULTS.startingAllocation,
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
    console.error(error);
    return NextResponse.json({ error: "Could not create the table." }, { status: 500 });
  }
}
