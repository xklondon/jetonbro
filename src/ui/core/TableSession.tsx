"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSnapshot } from "@/application/queries/views";
import { getSkin } from "@/ui/skins/registry";

async function sendCommand(tableId: string, command: string, payload: Record<string, string> = {}) {
  const response = await fetch(`/api/tables/${tableId}/commands`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      command,
      idempotencyKey: crypto.randomUUID(),
      ...payload,
    }),
  });
  const data = (await response.json()) as { error?: string; abandoned?: boolean };
  if (!response.ok) {
    throw new Error(data.error ?? "This action could not be completed.");
  }
  return data;
}

export function TableSession({ initial }: { initial: ClientSnapshot }) {
  const skin = getSkin();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(initial.player?.boxes[0]?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const response = await fetch(`/api/tables/${snapshot.tableId}/snapshot`);
      if (!response.ok || cancelled) return;
      const next = (await response.json()) as ClientSnapshot;
      if (next.tableId) setSnapshot(next);
    }
    const source = new EventSource(`/api/tables/${snapshot.tableId}/stream`);
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as ClientSnapshot;
      setSnapshot(next);
    };
    source.onerror = () => {
      void refresh();
    };
    const poll = window.setInterval(() => {
      void refresh();
    }, 2500);
    return () => {
      cancelled = true;
      source.close();
      window.clearInterval(poll);
    };
  }, [snapshot.tableId]);

  useEffect(() => {
    const ids = new Set((snapshot.player?.boxes ?? []).map((box) => box.id));
    if (selectedBoxId && ids.has(selectedBoxId)) return;
    setSelectedBoxId(snapshot.player?.boxes[0]?.id ?? null);
  }, [snapshot.player?.boxes, selectedBoxId]);

  const onCommand = async (command: string, payload: Record<string, string> = {}) => {
    setNotice(null);
    try {
      const result = await sendCommand(snapshot.tableId, command, payload);
      if (command === "abandonDraft" && result.abandoned) {
        router.push("/");
        return;
      }
      const refresh = await fetch(`/api/tables/${snapshot.tableId}/snapshot`);
      if (!refresh.ok) {
        const failed = (await refresh.json()) as { error?: string };
        throw new Error(failed.error ?? "Could not refresh the table.");
      }
      const next = (await refresh.json()) as ClientSnapshot;
      if (!next.tableId) {
        throw new Error("Could not refresh the table.");
      }
      setSnapshot(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Something went wrong.");
    }
  };

  const playerMembers = useMemo(
    () => snapshot.members.filter((member) => (snapshot.isBank || snapshot.isOwner ? true : member.userId === snapshot.viewerId)),
    [snapshot],
  );

  if (snapshot.setup) {
    return <skin.SetupTable view={snapshot.setup} onCommand={onCommand} notice={notice} />;
  }
  if (snapshot.waiting) {
    return <skin.WaitingTable view={snapshot.waiting} />;
  }
  if (snapshot.bank) {
    return <skin.BankTable view={snapshot.bank} members={playerMembers} onCommand={onCommand} notice={notice} />;
  }
  if (snapshot.player) {
    return (
      <skin.PlayerTable
        view={snapshot.player}
        selectedBoxId={selectedBoxId}
        onSelectBox={setSelectedBoxId}
        onCommand={onCommand}
        notice={notice}
      />
    );
  }
  return <skin.WaitingTable view={{ role: "WAITING", phase: "TABLE_SETUP", tableName: "JetonBro", game: "Blackjack", available: { millis: "0", label: "0" }, copy: "Loading table" }} />;
}
