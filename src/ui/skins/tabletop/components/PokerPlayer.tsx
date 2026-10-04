"use client";

import type { PokerTableView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { PokerBoard } from "./PokerTable";

/** Poker Player: the shared felt with actor actions and the wallet. No Owner chrome. */
export function PokerPlayer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  return <PokerBoard view={view} onCommand={onCommand} notice={notice} owner={false} />;
}
