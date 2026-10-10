"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { PokerAwardOverlay } from "./primitives/PokerAwardOverlay";
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
  const setup = view.phase === "POKER_SETUP" || view.phase === "TABLE_SETUP";
  const showdown = view.phase === "SHOWDOWN" && view.canAward;
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (view.phase !== "SHOWDOWN") setWinners({});
  }, [view.phase, view.handNumber]);

  const winnerPayload = useMemo(
    () => JSON.stringify(view.pots.map((pot) => ({ index: pot.index, winnerIds: winners[pot.index] ?? pot.winnerPlayerIds }))),
    [view.pots, winners],
  );

  function toggleWinner(potIndex: number, userId: string) {
    const pot = view.pots.find((item) => item.index === potIndex);
    if (!pot || pot.winnerPlayerIds.length > 0) return;
    const current = winners[potIndex] ?? pot.winnerPlayerIds;
    const selected = current.includes(userId);
    setWinners({
      ...winners,
      [potIndex]: selected ? current.filter((id) => id !== userId) : [...current, userId],
    });
  }

  const badges = (
    <>
      {view.isOwner ? <span className="pm-badge">OWNER</span> : null}
      <span className="pm-badge">DEALER</span>
    </>
  );

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      board="POKER_DEALER"
      dock={
        <CasinoConsole
          notice={notice ? <div className="pm-console-notice">{notice}</div> : null}
          available={view.available.label !== "0" ? view.available.label : undefined}
          showTray={false}
          reserveTray={false}
          primary={
            showdown
              ? null
              : view.canNextHand
                ? {
                    label: "START HAND",
                    onClick: () => void onCommand("pokerNextHand"),
                  }
                : view.canDealStreet
                  ? {
                      label: view.nextStreetLabel || "DEAL",
                      onClick: () => void onCommand("pokerDealStreet"),
                    }
                  : null
          }
          secondary={
            !showdown && view.canAddPlayer ? { label: "ADD PLAYER", onClick: () => undefined } : null
          }
        >
          {showdown ? (
            <PokerAwardOverlay
              view={view}
              winners={winners}
              onToggle={toggleWinner}
              onConfirm={() => {
                setBusy(true);
                void Promise.resolve(onCommand("awardPokerPots", { pots: winnerPayload })).finally(() => setBusy(false));
              }}
              onClear={() => setWinners({})}
              busy={busy}
            />
          ) : null}
        </CasinoConsole>
      }
    >
      <PokerTable
        tableName={view.tableName}
        instruction={setup ? phaseCopy.instruction : undefined}
        phase={view.phase}
        pot={view.pot.label}
        seats={view.seats}
        viewerId={view.viewerId}
      />
    </PremiumShell>
  );
}
