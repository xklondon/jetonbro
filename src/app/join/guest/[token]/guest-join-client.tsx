"use client";

import { getSkin } from "@/ui/skins/registry";
import { useState } from "react";

export function GuestJoinClient({
  token,
  tableName,
  startingJetons,
  state,
}: {
  token: string;
  tableName: string;
  startingJetons: string;
  state: "invalid" | "ready";
}) {
  const skin = getSkin();
  const [notice, setNotice] = useState<string | null>(
    state === "invalid" ? "This invitation is not valid or has expired." : null,
  );

  return (
    <skin.Entry
      title="Join without email"
      copy={`Guest access is limited to ${tableName}. Both devices need a connection. Starts with ${startingJetons} jetons.`}
      actionLabel="Join table"
      notice={notice}
      requireEmail={false}
      extraFields={[{ name: "playName", label: "Play name", placeholder: "Play name" }]}
      onSubmit={async (fields) => {
        const response = await fetch(`/api/join/guest/${token}`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ playName: fields.playName }),
        });
        const data = (await response.json()) as { tableId?: string; error?: string };
        if (!response.ok || !data.tableId) {
          setNotice(data.error ?? "This invitation is not valid or has expired.");
          return;
        }
        window.location.replace(`/tables/${data.tableId}`);
      }}
    />
  );
}
