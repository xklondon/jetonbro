import { getActor, assertActorCanAccessTable } from "@/application/actor";
import { loadSnapshot } from "@/application/queries/snapshot";
import { TableSession } from "@/ui/core/TableSession";
import { redirect } from "next/navigation";

export default async function TablePage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const actor = await getActor({ tableId });
  if (!actor) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/tables/${tableId}`)}`);
  }
  assertActorCanAccessTable(actor, tableId);
  const snapshot = await loadSnapshot(tableId, actor.id);
  return <TableSession initial={snapshot} />;
}
