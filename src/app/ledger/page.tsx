import { getActor, assertVerifiedActor } from "@/application/actor";
import { listPersonalLedger } from "@/application/services/game-session";
import { redirect } from "next/navigation";
import { LedgerClient } from "./ledger-client";

export default async function LedgerPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in?callbackUrl=/ledger");
  if (actor.isGuest) redirect("/");
  try {
    assertVerifiedActor(actor);
  } catch {
    redirect("/");
  }
  const entries = await listPersonalLedger(actor.id);
  return <LedgerClient entries={entries} />;
}
