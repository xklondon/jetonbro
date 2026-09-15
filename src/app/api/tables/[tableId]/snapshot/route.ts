import { NextResponse } from "next/server";
import { auth } from "@/application/auth";
import { loadSnapshot } from "@/application/queries/snapshot";
import { DomainError } from "@/domain/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ tableId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { tableId } = await context.params;
  try {
    const snapshot = await loadSnapshot(tableId, session.user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not load the table." }, { status: 500 });
  }
}
