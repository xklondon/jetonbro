import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/application/auth";
import { DomainError } from "@/domain/errors";
import { createTable } from "@/application/services/tables";

const schema = z.object({
  name: z.string().min(1),
  startingAllocation: z.string().optional(),
  minBet: z.string().optional(),
  maxBet: z.string().optional(),
  blackjackPayout: z.enum(["THREE_TWO", "SIX_FIVE"]).optional(),
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
      ...body,
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
