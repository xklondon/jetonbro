import { NextResponse } from "next/server";
import { prisma } from "@/application/db";
import { hoursFromNow, randomToken } from "@/application/ids";
import { allowDevMailbox } from "@/application/dev-only";

export function GET() {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function POST(request: Request) {
  if (!allowDevMailbox()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = (await request.json()) as { email?: string; name?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Email required." }, { status: 400 });
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: body.name ?? undefined, emailVerified: new Date() },
    create: { email, name: body.name ?? email.split("@")[0], emailVerified: new Date() },
  });
  const sessionToken = randomToken();
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: hoursFromNow(24),
    },
  });
  return NextResponse.json({ userId: user.id, sessionToken, email: user.email });
}
