import { NextResponse } from "next/server";
import { joinAsGuest } from "@/application/services/invitations";
import { prisma } from "@/application/db";
import { DomainError } from "@/domain/errors";
import { assertInvitationUsable } from "@/domain/invitations/types";
import { guestCookieFromHeader, guestCookieOptions, GUEST_COOKIE, readGuestCookie, signGuestToken } from "@/application/guest-session";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.kind !== "GUEST") {
    return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  }
  try {
    assertInvitationUsable(invitation, new Date());
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
  }
  const table = await prisma.table.findUnique({ where: { id: invitation.tableId } });
  return NextResponse.json({
    tableName: table?.name ?? "Table",
    startingJetons: table ? Number(table.startingJetonsPerPlayerMillis) / 1000 : 100,
    intent: "guest",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  let playName = "";
  try {
    const body = (await request.json()) as { playName?: string };
    playName = body.playName ?? "";
  } catch {
    playName = "";
  }
  try {
    const existing = guestCookieFromHeader(request.headers.get("cookie")) ?? (await readGuestCookie());
    const result = await joinAsGuest({
      token,
      playName,
      existingGuestUserId: existing?.userId ?? null,
    });
    const response = NextResponse.json(result);
    response.cookies.set(GUEST_COOKIE, signGuestToken(result.userId, result.tableId), guestCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not join this table." }, { status: 500 });
  }
}
