import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertVerifiedActor, getActor } from "@/application/actor";
import { DomainError } from "@/domain/errors";
import { deleteAllMyTables } from "@/application/services/tables";

const schema = z.object({
  command: z.literal("deleteAllMyTables"),
  confirmation: z.string(),
  idempotencyKey: z.string().min(8),
});

export async function POST(request: NextRequest) {
  const actor = await getActor({ cookieHeader: request.headers.get("cookie") });
  try {
    assertVerifiedActor(actor);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid command." }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid command." }, { status: 400 });
  }
  try {
    const result = await deleteAllMyTables({
      actorId: actor!.id,
      idempotencyKey: parsed.data.idempotencyKey,
      confirmation: parsed.data.confirmation,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "This action could not be completed." }, { status: 500 });
  }
}
