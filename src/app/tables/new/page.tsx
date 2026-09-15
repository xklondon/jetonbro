import { auth } from "@/application/auth";
import { redirect } from "next/navigation";
import { CreateTableClient } from "./create-table-client";

export default async function CreateTablePage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in?callbackUrl=/tables/new");
  return <CreateTableClient />;
}
