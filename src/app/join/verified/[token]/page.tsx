import { auth } from "@/application/auth";
import { prisma } from "@/application/db";
import { VerifiedJoinClient } from "./verified-join-client";

export default async function VerifiedJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.kind === "GUEST") {
    return <VerifiedJoinClient token={token} signedIn={false} emailBound={null} state="invalid" />;
  }
  return (
    <VerifiedJoinClient
      token={token}
      signedIn={Boolean(session?.user?.id)}
      emailBound={invitation.kind === "EMAIL" ? invitation.email : null}
      state="ready"
    />
  );
}
