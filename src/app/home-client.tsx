"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HomeTableCard } from "@/application/queries/home";

export function HomeClient({
  displayName,
  defaultTableName,
  tables,
}: {
  displayName: string;
  defaultTableName: string;
  tables: HomeTableCard[];
}) {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  async function onCreateTable() {
    router.replace("/tables/new");
  }

  async function onTableCommand(tableId: string, command: "saveTable" | "closeTable" | "deleteTable") {
    const response = await fetch(`/api/tables/${tableId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command, idempotencyKey: crypto.randomUUID() }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setNotice(data.error ?? "This action could not be completed.");
      return;
    }
    setNotice(null);
    router.refresh();
  }

  return (
    <skin.Home
      displayName={displayName}
      defaultTableName={defaultTableName}
      tables={tables}
      notice={notice}
      onCreateTable={onCreateTable}
      onJoinTable={(destination) => router.push(destination)}
      onOpenTable={(tableId) => router.push(`/tables/${tableId}`)}
      onTableCommand={onTableCommand}
    />
  );
}
