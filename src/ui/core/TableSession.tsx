"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSnapshot } from "@/application/queries/views";
import { getSkin } from "@/ui/skins/registry";
import { shouldApplySnapshot } from "@/ui/core/snapshot-revision";
import { selectTableBoard } from "@/ui/core/table-board";

async function sendCommand(tableId: string, command: string, payload: Record<string, string> = {}) {
    const response = await fetch(`/api/tables/${tableId}/commands`, {
      cache: "no-store",
      method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      command,
      idempotencyKey: crypto.randomUUID(),
      ...payload,
    }),
  });
  const data = (await response.json()) as {
    error?: string;
    code?: string;
    abandoned?: boolean;
    emailWarning?: string | null;
  };
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
  const commandSeq = useRef(0);

  const applySnapshot = useCallback((next: ClientSnapshot) => {
    if (!next.tableId) return;
    setSnapshot((current) => (shouldApplySnapshot(current, next) ? next : current));
  }, []);

  const refreshSnapshot = useCallback(async () => {
    const response = await fetch(`/api/tables/${snapshot.tableId}/snapshot`, { cache: "no-store" });
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
        const response = await fetch(`/api/tables/${snapshot.tableId}/snapshot`, { cache: "no-store" });
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
    const seq = ++commandSeq.current;
    setNotice(null);
    try {
      const result = await sendCommand(snapshot.tableId, command, payload);
      if (seq !== commandSeq.current) return false;
      if (result.emailWarning) {
        setNotice(result.emailWarning);
      }
      if (command === "abandonDraft" && result.abandoned) {
        router.push("/");
        return true;
      }
      if (command === "saveTable" || command === "closeTable") {
        router.push("/");
        return true;
      }
      await refreshSnapshot();
      return true;
    } catch (error) {
      if (seq !== commandSeq.current) return false;
      const code = error instanceof Error ? error.name : "";
      setNotice(code === "TURN_CONFLICT" ? "TURN_CONFLICT" : error instanceof Error ? error.message : "Something went wrong.");
      try {
        await refreshSnapshot();
      } catch {
        // Keep the domain error visible even if the follow-up refresh fails.
      }
      return false;
    }
  };

  const playerMembers = useMemo(
    () => snapshot.members.filter((member) => (snapshot.isBank || snapshot.isOwner ? true : member.userId === snapshot.viewerId)),
    [snapshot],
  );

  const board = selectTableBoard(snapshot);

  if (board === "CREATE_TABLE" && snapshot.setup) {
    return (
      <skin.CreateTable
        defaultTableName={snapshot.setup.tableName}
        defaultStartingJetons={snapshot.setup.startingJetonsPerPlayer.label}
        defaultHostName={snapshot.setup.ownerName}
        notice={notice}
        view={snapshot.setup}
        onCommand={onCommand}
        onBack={() => void onCommand("abandonDraft")}
        onCreate={async () => undefined}
      />
    );
  }
  if (board === "PHASE_ZERO_DEALER") {
    return (
      <skin.PhaseZero
        setup={snapshot.setup}
        waiting={snapshot.waiting}
        poker={snapshot.game === "POKER" ? snapshot.poker : null}
        members={snapshot.members}
        onCommand={onCommand}
        notice={notice}
        isOwner={snapshot.isOwner}
        isBank={snapshot.isBank}
        viewerId={snapshot.viewerId}
        game={snapshot.game}
      />
    );
  }
  if (board === "PHASE_ZERO_PLAYER") {
    return (
      <skin.WaitingTable
        view={
          snapshot.waiting ?? {
            role: "WAITING",
            phase: "TABLE_SETUP",
            tableName: snapshot.setup?.tableName ?? snapshot.player?.tableName ?? "JetonBro",
            game: snapshot.gameLabel ?? (snapshot.game === "POKER" ? "Texas Hold’em" : "Blackjack"),
            gameId: snapshot.game,
            available: snapshot.player?.available ?? { millis: "0", label: "0" },
            copy: "WAITING FOR PLAYERS",
            members: snapshot.members,
          }
        }
      />
    );
  }
  if (board === "POKER_DEALER" && snapshot.poker) {
    return <skin.PokerDealer view={snapshot.poker} members={playerMembers} onCommand={onCommand} notice={notice} />;
  }
  if (board === "POKER_PLAYER" && snapshot.poker) {
    return <skin.PokerPlayer view={snapshot.poker} onCommand={onCommand} notice={notice} />;
  }
  if (board === "BLACKJACK_DEALER" && snapshot.bank) {
    return <skin.BankTable view={snapshot.bank} members={playerMembers} onCommand={onCommand} notice={notice} />;
  }
  if (board === "BLACKJACK_PLAYER" && snapshot.player) {
    return (
      <skin.PlayerTable
        view={snapshot.player}
        selectedBoxId={selectedBoxId}
        onSelectBox={setSelectedBoxId}
        onCommand={onCommand}
        notice={notice}
        members={playerMembers}
      />
    );
  }
  return (
    <skin.WaitingTable
      view={{
        role: "WAITING",
        phase: "TABLE_SETUP",
        tableName: "JetonBro",
        game: "Blackjack",
        available: { millis: "0", label: "0" },
        copy: "Loading table",
      }}
    />
  );
}
