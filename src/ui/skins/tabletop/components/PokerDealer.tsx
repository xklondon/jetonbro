"use client";

import type { MemberView, PokerTableView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { PokerBoard } from "./PokerTable";

/** Poker Owner: same felt as the Player plus street controls in the rail and the table menu. */
export function PokerDealer({
  view,
  members,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  return <PokerBoard view={view} members={members} onCommand={onCommand} notice={notice} owner />;
}
