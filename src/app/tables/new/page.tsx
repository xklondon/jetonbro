import { auth } from "@/application/auth";
import { defaultTableName, firstName } from "@/application/auth-urls";
import { ensureDraftTable } from "@/application/services/tables";
import { redirect } from "next/navigation";

export default async function CreateTablePage() {
  const session = await auth();
  if (!session?.user?.id) redirect(`/sign-in?callbackUrl=${encodeURIComponent("/tables/new")}`);
  const displayName = firstName(session.user.name || session.user.email || "Player");
  const { tableId } = await ensureDraftTable({
    actorId: session.user.id,
    name: defaultTableName(displayName),
  });
  redirect(`/tables/${tableId}`);
}
