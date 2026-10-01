import { NextResponse } from "next/server";
import { getActor, assertActorCanAccessTable } from "@/application/actor";
import { loadSnapshot } from "@/application/queries/snapshot";
import { DomainError } from "@/domain/errors";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const { tableId } = await context.params;
  const actor = await getActor({ tableId });
  if (!actor) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    assertActorCanAccessTable(actor, tableId);
    const snapshot = await loadSnapshot(tableId, actor.id);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not load the table." }, { status: 500 });
  }
}
