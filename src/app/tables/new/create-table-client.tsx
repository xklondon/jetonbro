"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function CreateTableClient({
  defaultTableName,
}: {
  defaultTableName: string;
}) {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);
  const payloadRef = useRef<string | null>(null);
  return (
    <skin.CreateTable
      defaultTableName={defaultTableName}
      notice={notice}
      onBack={() => router.push("/")}
      onCreate={async (fields) => {
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
      }}
    />
  );
}
