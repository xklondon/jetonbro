import { NextResponse } from "next/server";
import { getActor, assertVerifiedActor } from "@/application/actor";
import { listPersonalLedger } from "@/application/services/game-session";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const actor = await getActor();
  try {
    assertVerifiedActor(actor);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const entries = await listPersonalLedger(actor!.id);
  return NextResponse.json({ entries });
}
