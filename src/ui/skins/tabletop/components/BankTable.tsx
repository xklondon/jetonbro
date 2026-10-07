"use client";

import type { BankTableView, MemberView } from "@/application/queries/views";
import type { CommandHandler } from "@/ui/skins/types";
import { BlackjackDealerTable } from "./BlackjackDealerTable";

/** Adapter: live and Phase 0 Dealer Blackjack both mount the canonical felt. */
export function BankTable({
  view,
  members,
  onCommand,
  notice,
}: {
  view: BankTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
}) {
  return <BlackjackDealerTable view={view} members={members} onCommand={onCommand} notice={notice} />;
}
