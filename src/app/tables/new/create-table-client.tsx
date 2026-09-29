"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSkin } from "@/ui/skins/registry";

export function CreateTableClient({
  defaultTableName,
  defaultStartingJetons,
  needsHostName,
  defaultHostName,
}: {
  defaultTableName: string;
  defaultStartingJetons: string;
  needsHostName: boolean;
  defaultHostName: string;
}) {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <skin.CreateTable
      defaultTableName={defaultTableName}
      defaultStartingJetons={defaultStartingJetons}
      needsHostName={needsHostName}
      defaultHostName={defaultHostName}
      notice={notice}
      onBack={() => router.push("/")}
      onCreate={async (fields) => {
        const response = await fetch("/api/tables", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: fields.name,
            startingJetonsPerPlayer: fields.startingJetonsPerPlayer,
            hostName: fields.hostName,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
        const data = (await response.json()) as { tableId?: string; error?: string };
        if (!response.ok || !data.tableId) {
          setNotice(data.error ?? "Could not create the table.");
          return;
        }
        router.replace(`/tables/${data.tableId}`);
      }}
    />
  );
}
