import { prisma } from "@/application/db";
import { guestJoinPath, verifiedJoinPath } from "@/application/invite-urls";
import { redirect } from "next/navigation";
import { JoinClient } from "./join-client";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) {
    return <JoinClient token={token} state="invalid" />;
  }
  redirect(invitation.kind === "GUEST" ? guestJoinPath(token) : verifiedJoinPath(token));
}
