import { auth } from "@/application/auth";
import { defaultTableName, firstName } from "@/application/auth-urls";
import { BLACKJACK_TABLE_DEFAULTS } from "@/domain/blackjack/settings";
import { redirect } from "next/navigation";
import { CreateTableClient } from "./create-table-client";

export default async function CreateTablePage() {
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent("/tables/new")}`);
  const displayName = firstName(session.user.name || session.user.email || "Player");
  const needsHostName = !session.user.name?.trim();
  return (
    <CreateTableClient
      defaultTableName={defaultTableName(displayName)}
      defaultStartingJetons={BLACKJACK_TABLE_DEFAULTS.startingAllocation}
      needsHostName={needsHostName}
      defaultHostName={needsHostName ? displayName : ""}
    />
  );
}
