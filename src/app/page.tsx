import { auth } from "@/application/auth";
import { prisma } from "@/application/db";
import { redirect } from "next/navigation";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  const memberships = await prisma.tableMember.findMany({
    where: { userId: session.user.id, leftAt: null },
    include: { table: true },
    orderBy: { joinedAt: "desc" },
  });
  return (
    <HomeClient
      name={session.user.name || session.user.email || "Player"}
      tables={memberships.map((membership) => ({
        id: membership.table.id,
        name: membership.table.name,
        phase: membership.table.currentPhase,
      }))}
    />
  );
}
