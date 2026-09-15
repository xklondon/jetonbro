"use client";

import { getSkin } from "@/ui/skins/registry";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function JoinClient({
  token,
  state,
}: {
  token: string;
  state: "invalid" | "ready";
}) {
  const skin = getSkin();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(
    state === "invalid" ? "This invitation is not valid or has expired." : "Joining the table…",
  );

  useEffect(() => {
    if (state !== "ready") return;
    void (async () => {
      const response = await fetch(`/api/join/${token}`, { method: "POST" });
      const data = (await response.json()) as { tableId?: string; error?: string };
      if (!response.ok || !data.tableId) {
        setNotice(data.error ?? "This invitation is not valid or has expired.");
        return;
      }
      router.replace(`/tables/${data.tableId}`);
    })();
  }, [router, state, token]);

  return (
    <skin.Entry
      title="Join table"
      copy="You will return to the same table after signing in."
      actionLabel="Open JetonBro"
      notice={notice}
      requireEmail={false}
      onSubmit={async () => {
        router.push("/sign-in");
      }}
    />
  );
}
