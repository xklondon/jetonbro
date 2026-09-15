"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateTableClient({
  defaultTableName,
  initialGame,
}: {
  defaultTableName: string;
  initialGame: "BLACKJACK" | null;
}) {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <skin.CreateTable
      defaultTableName={defaultTableName}
      initialGame={initialGame}
      notice={notice}
      onBack={() => router.push("/")}
      onCreate={async (fields) => {
        const response = await fetch("/api/tables", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: fields.name,
            game: fields.game,
            startingAllocation: fields.startingAllocation || undefined,
            blackjackPayout: fields.blackjackPayout,
            maxBoxesPerPlayer: Number.parseInt(fields.maxBoxesPerPlayer, 10),
            insuranceEnabled: fields.insuranceEnabled,
            bankMayDistributeJetons: true,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const data = (await response.json()) as { tableId?: string; error?: string };
        if (!response.ok || !data.tableId) {
          setNotice(data.error ?? "Could not create the table.");
          return;
        }
        router.push(`/tables/${data.tableId}`);
      }}
    />
  );
}
