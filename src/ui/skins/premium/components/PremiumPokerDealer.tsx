"use client";

import type { MemberView, PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { PokerTable } from "./primitives/PokerTable";

export function PremiumPokerDealer({
  view,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
}) {
  const phaseCopy = pokerPhaseCopy({
    phase: view.phase,
    waitingCopy: view.waitingCopy,
    actorName: view.currentActorName,
  });
  const badges = (
    <>
      {view.isOwner ? <span className="pm-badge">OWNER</span> : null}
      <span className="pm-badge">DEALER</span>
    </>
  );
  return (
    <PremiumShell
      title={view.tableName}
      badges={badges}
      board="POKER_DEALER"
      dock={
        <CasinoConsole
          notice={notice ? <div className="pm-bj-empty">{notice}</div> : null}
          available={view.available.label}
          showTray={false}
          primary={
            view.canNextHand
              ? {
                  label: "START HAND",
                  onClick: () => void onCommand("pokerNextHand"),
                }
              : view.canDealStreet
                ? {
                    label: view.nextStreetLabel || "DEAL",
                    onClick: () => void onCommand("pokerDealStreet"),
                  }
                : view.canAward
                  ? { label: "AWARD POT", onClick: () => void onCommand("pokerAward") }
                  : null
          }
          secondary={
            view.canAddPlayer ? { label: "ADD PLAYER", onClick: () => undefined } : null
          }
        />
      }
    >
      <PokerTable
        tableName={view.tableName}
        phaseLabel={phaseCopy.primary}
        instruction={phaseCopy.instruction}
        phase={view.phase}
        pot={view.pot.label}
        seats={view.seats}
        viewerId={view.viewerId}
      />
    </PremiumShell>
  );
}
