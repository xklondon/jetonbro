"use client";

import type { WaitingTableView } from "@/application/queries/views";
import { ClassicPhaseZero } from "./ClassicPhaseZero";

export function ClassicWaitingTable({ view }: { view: WaitingTableView }) {
  return (
    <ClassicPhaseZero
      setup={null}
      waiting={view}
      poker={null}
      members={view.members ?? []}
      onCommand={async () => undefined}
      isOwner={false}
      isBank={false}
      viewerId=""
      game={view.gameId === "POKER" ? "POKER" : "BLACKJACK"}
    />
  );
}
