import { auth } from "@/application/auth";
import { JoinClient } from "./join-client";
import { redirect } from "next/navigation";
import { prisma } from "@/application/db";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    return <JoinClient token={token} state="invalid" />;
  }
  if (!session?.user) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/join/${token}`)}`);
  }
  return <JoinClient token={token} state="ready" />;
}
