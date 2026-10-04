"use client";

import type { SetupTableView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { CreateTable } from "./CreateTable";
import { PhaseZero } from "./PhaseZero";

/** Setup router: Create Table until `finalizeSetup`, then the Phase 0 board. */
export function SetupTable({
  view,
  onCommand,
  notice,
}: {
  view: SetupTableView;
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  if (!view.setupCompleted) {
    return (
      <CreateTable
        defaultTableName={view.tableName}
        defaultStartingJetons={view.startingJetonsPerPlayer.label}
        defaultHostName={view.ownerName}
        notice={notice}
        view={view}
        onCommand={onCommand}
        onBack={() => void onCommand("abandonDraft")}
        onCreate={async () => undefined}
      />
    );
  }
  return (
    <PhaseZero
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
