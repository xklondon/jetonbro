import { getActor, assertVerifiedActor } from "@/application/actor";
import { defaultTableName, firstName } from "@/application/auth-urls";
import { ensureDraftTable } from "@/application/services/tables";
import { redirect } from "next/navigation";

export default async function CreateTablePage() {
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?callbackUrl=${encodeURIComponent("/tables/new")}`);
  if (actor.isGuest) redirect(actor.guestTableId ? `/tables/${actor.guestTableId}` : "/");
  assertVerifiedActor(actor);
  const displayName = firstName(actor.name || actor.email || "Player");
  const created = await ensureDraftTable({
    actorId: actor.id,
    name: defaultTableName(displayName),
  });
  redirect(`/tables/${created.tableId}`);
}
