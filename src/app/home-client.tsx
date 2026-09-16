"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
  const keyRef = useRef<string>(crypto.randomUUID());

  async function onCreateTable() {
    const response = await fetch("/api/tables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft: true,
        name: defaultTableName,
        game: "BLACKJACK",
        blackjackPayout: "THREE_TWO",
        maxBoxesPerPlayer: 3,
        insuranceEnabled: true,
        bankMayDistributeJetons: true,
        idempotencyKey: keyRef.current,
      }),
    });
    const data = (await response.json()) as { tableId?: string; error?: string };
    if (!response.ok || !data.tableId) {
      setNotice(data.error ?? "Could not create the table.");
      return;
    }
    router.push(`/tables/${data.tableId}`);
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
