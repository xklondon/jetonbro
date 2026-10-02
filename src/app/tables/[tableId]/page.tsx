import { getActor, assertActorCanAccessTable } from "@/application/actor";
import { loadSnapshot } from "@/application/queries/snapshot";
import { TableSession } from "@/ui/core/TableSession";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TablePage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const actor = await getActor({ tableId, cookieHeader: (await headers()).get("cookie") });
  if (!actor) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/tables/${tableId}`)}`);
  }
  assertActorCanAccessTable(actor, tableId);
  const snapshot = await loadSnapshot(tableId, actor.id);
  return <TableSession initial={snapshot} />;
}
