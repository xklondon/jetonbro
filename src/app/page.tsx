import { auth } from "@/application/auth";
import { listHomeTables } from "@/application/queries/home";
import { firstName } from "@/application/auth-urls";
import { redirect } from "next/navigation";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=/");
  }
  const tables = await listHomeTables(session.user.id);
  const displayName = firstName(session.user.name || session.user.email || "Player");
  return <HomeClient displayName={displayName} tables={tables} />;
}
