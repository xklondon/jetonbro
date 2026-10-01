import { prisma } from "@/application/db";
import { formatJetons } from "@/domain/money";
import { GuestJoinClient } from "./guest-join-client";

export default async function GuestJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.kind !== "GUEST") {
    return <GuestJoinClient token={token} tableName="JetonBro" startingJetons="100" state="invalid" />;
  }
  const table = await prisma.table.findUnique({ where: { id: invitation.tableId } });
  return (
    <GuestJoinClient
      token={token}
      tableName={table?.name ?? "Table"}
      startingJetons={table ? formatJetons(table.startingJetonsPerPlayerMillis) : "100"}
      state="ready"
    />
  );
}
