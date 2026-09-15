import { auth } from "@/application/auth";
import { loadSnapshot } from "@/application/queries/snapshot";
import { TableSession } from "@/ui/core/TableSession";
import { redirect } from "next/navigation";

export default async function TablePage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const session = await auth();
  const { tableId } = await params;
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=/tables/${tableId}`);
  }
  const snapshot = await loadSnapshot(tableId, session.user.id);
  return <TableSession initial={snapshot} />;
}
