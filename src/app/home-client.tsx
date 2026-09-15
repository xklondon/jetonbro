"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import type { HomeTableCard } from "@/application/queries/home";

export function HomeClient({
  displayName,
  tables,
}: {
  displayName: string;
  tables: HomeTableCard[];
}) {
  const skin = getSkin();
  const router = useRouter();
  return (
    <skin.Home
      displayName={displayName}
      tables={tables}
      onCreateTable={() => router.push(tables.length === 0 ? "/tables/new?game=BLACKJACK" : "/tables/new")}
      onJoinTable={(destination) => router.push(destination)}
      onOpenTable={(tableId) => router.push(`/tables/${tableId}`)}
    />
  );
}
