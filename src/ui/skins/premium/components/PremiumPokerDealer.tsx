"use client";

import { useEffect, useMemo, useState } from "react";
import type { InvitationView, MemberView, PokerTableView } from "@/application/queries/views";
import { pokerControls } from "@/application/queries/poker-controls";
import { pokerPhaseCopy, pokerStartHandNotice } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumInviteMask } from "./PremiumInviteMask";
import { PremiumShell } from "./PremiumShell";
import { CasinoConsole } from "./primitives/CasinoConsole";
import { PokerAwardOverlay } from "./primitives/PokerAwardOverlay";
import { PokerTable } from "./primitives/PokerTable";

export function PremiumPokerDealer({
  view,
  members,
  onCommand,
  notice,
  guestJoinUrl = null,
  verifiedJoinUrl = null,
  invitations,
  startingJetons,
  emailConfigured = true,
}: {
  view: PokerTableView;
  members: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
  guestJoinUrl?: string | null;
  verifiedJoinUrl?: string | null;
  invitations?: InvitationView[];
  startingJetons?: string;
  emailConfigured?: boolean;
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const controls = pokerControls(view);
  const startHand = controls.find((control) => control.id === "startHand");
  const nextHand = controls.find((control) => control.id === "nextHand");
  const seatedCount = view.seats.filter((seat) => Boolean(seat.userId)).length;
  const ownerSeated = view.seats.some((seat) => seat.userId === view.viewerId);
  const startEnabled = Boolean(startHand?.enabled && seatedCount >= 2);
  const seatNotice = pokerStartHandNotice(notice);

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

  let primary: { label: string; disabled?: boolean; onClick?: () => void } | null = null;
  if (showdown) {
    primary = null;
  } else if (startHand) {
    primary = {
      label: "START HAND",
      disabled: !startEnabled,
      onClick: () => void onCommand("startTexasHoldem"),
    };
  } else if (nextHand) {
    primary = {
      label: "START HAND",
      disabled: !nextHand.enabled,
      onClick: () => void onCommand("startNextPokerHand"),
    };
  } else if (view.canDealStreet) {
    primary = {
      label: view.nextStreetLabel || "DEAL",
      onClick: () => void onCommand("advancePokerStreet"),
    };
  }

  const showAdd = Boolean(view.canAddPlayer && (setup || view.phase === "HAND_COMPLETE"));

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      board="POKER_DEALER"
      dock={
        <CasinoConsole
          variant={setup ? "setup" : "default"}
          notice={
            seatNotice || notice ? (
              <div className="pm-console-notice">{seatNotice ?? notice}</div>
            ) : null
          }
          available={ownerSeated && view.available.label !== "0" ? view.available.label : undefined}
          showTray={false}
          reserveTray={!setup && !showdown}
          primary={primary}
          secondary={
            showAdd
              ? {
                  label: "ADD PLAYER",
                  onClick: () => setInviteOpen(true),
                }
              : null
          }
        />
      }
    >
      <div className={`pm-poker-stage${showdown ? " is-payout" : ""}`}>
        <PokerTable
          tableName={view.tableName}
          instruction={setup ? phaseCopy.instruction : undefined}
          phase={view.phase}
          pot={view.pot.label}
          seats={view.seats}
          viewerId={view.viewerId}
        />
        {showdown ? (
          <div className="pm-poker-payout-zone">
            <PokerAwardOverlay
              view={view}
              winners={winners}
              onToggle={toggleWinner}
              onConfirm={() => {
                setBusy(true);
                void Promise.resolve(onCommand("awardPokerPots", { pots: winnerPayload })).finally(() =>
                  setBusy(false),
                );
              }}
              onClear={() => setWinners({})}
              busy={busy}
            />
          </div>
        ) : null}
      </div>
      <PremiumInviteMask
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        guestJoinUrl={guestJoinUrl}
        verifiedJoinUrl={verifiedJoinUrl}
        emailConfigured={emailConfigured}
        startingJetons={startingJetons ?? "100"}
        members={members}
        invitations={invitations}
        onCommand={onCommand}
        notice={notice}
      />
    </PremiumShell>
  );
}
