import { getActor } from "@/application/actor";
import { listHomeTables } from "@/application/queries/home";
import { defaultTableName, firstName } from "@/application/auth-urls";
import { redirect } from "next/navigation";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in?callbackUrl=/");
  }
  if (actor.isGuest && actor.guestTableId) {
    redirect(`/tables/${actor.guestTableId}`);
  }
  const tables = await listHomeTables(actor.id);
  const displayName = firstName(actor.name || actor.email || "Player");
  return (
    <HomeClient
      displayName={displayName}
      defaultTableName={defaultTableName(displayName)}
      tables={tables}
    />
  );
}
