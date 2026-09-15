"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { HomeTableCard } from "@/application/queries/home";
import type { CreateTableFields } from "@/ui/skins/classic/components/ClassicCreateTable";

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
  const keyRef = useRef<string | null>(null);
  const payloadRef = useRef<string | null>(null);

  async function onSetupTable(fields: CreateTableFields) {
    const payload = JSON.stringify(fields);
    if (payloadRef.current !== payload) {
      keyRef.current = crypto.randomUUID();
      payloadRef.current = payload;
    }
    const response = await fetch("/api/tables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: fields.name,
        game: fields.game,
        startingJetonsPerPlayer: fields.startingJetonsPerPlayer,
        emails: fields.emails,
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

  return (
    <skin.Home
      displayName={displayName}
      defaultTableName={defaultTableName}
      tables={tables}
      notice={notice}
      onSetupTable={onSetupTable}
      onJoinTable={(destination) => router.push(destination)}
      onOpenTable={(tableId) => router.push(`/tables/${tableId}`)}
    />
  );
}
