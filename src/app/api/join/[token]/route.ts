import { NextResponse } from "next/server";
import { auth } from "@/application/auth";
import { joinWithToken } from "@/application/services/invitations";
import { prisma } from "@/application/db";
import { DomainError } from "@/domain/errors";
import { assertInvitationUsable } from "@/domain/invitations/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  }
  try {
    assertInvitationUsable(invitation, new Date());
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
  }
  return NextResponse.json({
    tableId: invitation.tableId,
    emailBound: invitation.kind === "EMAIL" ? invitation.email : null,
  });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { token } = await context.params;
  try {
    const result = await joinWithToken({
      userId: session.user.id,
      userEmail: session.user.email,
      token,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.httpStatus });
    }
    console.error(error);
    return NextResponse.json({ error: "Could not join this table." }, { status: 500 });
  }
}
