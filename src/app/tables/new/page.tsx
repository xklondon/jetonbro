import { auth } from "@/application/auth";
import { defaultTableName, firstName } from "@/application/auth-urls";
import { redirect } from "next/navigation";
import { CreateTableClient } from "./create-table-client";

export default async function CreateTablePage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect(`/sign-in?callbackUrl=${encodeURIComponent("/tables/new")}`);
  const params = await searchParams;
  const displayName = firstName(session.user.name || session.user.email || "Player");
  return (
    <CreateTableClient
      defaultTableName={defaultTableName(displayName)}
      initialGame={params.game === "BLACKJACK" ? "BLACKJACK" : null}
    />
  );
}
