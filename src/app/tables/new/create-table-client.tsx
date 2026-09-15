"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateTableClient() {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <skin.Entry
      title="Create a table"
      copy="Blackjack for this version. Poker and Zilch are coming later."
      actionLabel="Open the table"
      notice={notice}
      requireEmail={false}
      extraFields={[
        { name: "name", label: "Table name", placeholder: "Table name" },
        { name: "startingAllocation", label: "Starting jetons", placeholder: "Starting jetons for you" },
        { name: "minBet", label: "Minimum bet", placeholder: "Minimum bet (optional)" },
        { name: "maxBet", label: "Maximum bet", placeholder: "Maximum bet (optional)" },
      ]}
      onSubmit={async (fields) => {
        const response = await fetch("/api/tables", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: fields.name,
            startingAllocation: fields.startingAllocation || undefined,
            minBet: fields.minBet || undefined,
            maxBet: fields.maxBet || undefined,
            blackjackPayout: "THREE_TWO",
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
