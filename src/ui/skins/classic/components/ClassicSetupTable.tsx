"use client";

import type { SetupTableView } from "@/application/queries/views";
import { ClassicCreateTable } from "./ClassicCreateTable";
import { ClassicPhaseZero } from "./ClassicPhaseZero";

export function ClassicSetupTable({
  view,
  onCommand,
  notice,
}: {
  view: SetupTableView;
  onCommand: (command: string, payload?: Record<string, string>) => void | boolean | Promise<void | boolean>;
  notice?: string | null;
}) {
  if (!view.setupCompleted) {
    return (
      <ClassicCreateTable
        defaultTableName={view.tableName}
        defaultStartingJetons={view.startingJetonsPerPlayer.label}
        defaultHostName={view.ownerName}
        notice={notice}
        view={view}
        onCommand={onCommand}
        onBack={() => onCommand("abandonDraft")}
        onCreate={async () => undefined}
      />
    );
  }
  return (
    <ClassicPhaseZero
      setup={view}
      waiting={null}
      poker={null}
      members={view.members}
      onCommand={onCommand}
      notice={notice}
      isOwner={view.isOwner}
      isBank={view.isBank !== false}
      viewerId={view.members.find((member) => member.isOwner)?.userId ?? ""}
      game={view.gameId === "POKER" ? "POKER" : "BLACKJACK"}
    />
  );
}
