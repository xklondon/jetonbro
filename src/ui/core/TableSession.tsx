"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSnapshot } from "@/application/queries/views";
import { getSkin } from "@/ui/skins/registry";
import { shouldApplySnapshot } from "@/ui/core/snapshot-revision";

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
  const data = (await response.json()) as { error?: string; code?: string; abandoned?: boolean };
  if (!response.ok) {
    const error = new Error(data.error ?? "This action could not be completed.");
    error.name = data.code ?? "CommandError";
    throw error;
  }
  return data;
}

export function TableSession({ initial }: { initial: ClientSnapshot }) {
  const skin = getSkin();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(initial.player?.boxes[0]?.id ?? null);

  const applySnapshot = useCallback((next: ClientSnapshot) => {
    if (!next.tableId) return;
    setSnapshot((current) => (shouldApplySnapshot(current, next) ? next : current));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(`/api/tables/${snapshot.tableId}/snapshot`);
    if (!response.ok) {
      const failed = (await response.json()) as { error?: string };
      throw new Error(failed.error ?? "Could not refresh the table.");
    }
    const next = (await response.json()) as ClientSnapshot;
    if (!next.tableId) {
      throw new Error("Could not refresh the table.");
    }
    applySnapshot(next);
    return next;
  }, [applySnapshot, snapshot.tableId]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch(`/api/tables/${snapshot.tableId}/snapshot`);
        if (!response.ok || cancelled) return;
        const next = (await response.json()) as ClientSnapshot;
        if (!cancelled) applySnapshot(next);
      } catch {
        // Poll fallback is best-effort; the next tick or SSE will retry.
      }
    }
    const source = new EventSource(`/api/tables/${snapshot.tableId}/stream`);
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as ClientSnapshot;
      applySnapshot(next);
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
  }, [applySnapshot, snapshot.tableId]);

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
      if (command === "saveTable" || command === "closeTable") {
        router.push("/");
        return;
      }
      await refreshSnapshot();
    } catch (error) {
      const code = error instanceof Error ? error.name : "";
      setNotice(code === "TURN_CONFLICT" ? "TURN_CONFLICT" : error instanceof Error ? error.message : "Something went wrong.");
      try {
        await refreshSnapshot();
      } catch {
        // Keep the domain error visible even if the follow-up refresh fails.
      }
    }
  };

  const playerMembers = useMemo(
    () => snapshot.members.filter((member) => (snapshot.isBank || snapshot.isOwner ? true : member.userId === snapshot.viewerId)),
    [snapshot],
  );

  if (snapshot.poker) {
    if (snapshot.poker.isOwner) {
      return <skin.PokerDealer view={snapshot.poker} members={playerMembers} onCommand={onCommand} notice={notice} />;
    }
    return <skin.PokerPlayer view={snapshot.poker} onCommand={onCommand} notice={notice} />;
  }
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
