import { NextResponse } from "next/server";
import { prisma } from "@/application/db";
import { guestJoinPath, verifiedJoinPath } from "@/application/invite-urls";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  const url = new URL(request.url);
  if (!invitation) {
    return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  }
  const path = invitation.kind === "GUEST" ? guestJoinPath(token) : verifiedJoinPath(token);
  return NextResponse.redirect(new URL(path, url.origin));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    return NextResponse.json({ error: "This invitation is not valid." }, { status: 404 });
  }
  const url = new URL(request.url);
  const path = invitation.kind === "GUEST" ? `/api/join/guest/${token}` : `/api/join/verified/${token}`;
  return NextResponse.redirect(new URL(path, url.origin), 307);
}
