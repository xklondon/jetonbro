"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokerActorLayout,
  pokerControls,
  pokerTrayChipAct,
  pokerTrayEnabled,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
import type { InvitationView, MemberView, PokerTableView } from "@/application/queries/views";
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
  const isActor = view.currentActorId === view.viewerId;
  const phaseCopy = pokerPhaseCopy({
    phase: view.phase,
    waitingCopy: view.waitingCopy,
    isActor,
    actorName: view.currentActorName,
  });
  const setup = view.phase === "POKER_SETUP" || view.phase === "TABLE_SETUP";
  const betweenHands = view.phase === "HAND_COMPLETE";
  const showdown = view.phase === "SHOWDOWN" && view.canAward;
  /** Setup + between-hands use the compact action dock (no AVAILABLE / tray). */
  const compactDock = setup || betweenHands;
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const controls = pokerControls(view);
  const startHand = controls.find((control) => control.id === "startHand");
  const nextHand = controls.find((control) => control.id === "nextHand");
  const seatedCount = view.seats.filter((seat) => Boolean(seat.userId)).length;
  const ownerSeated = view.seats.some((seat) => seat.userId === view.viewerId);
  const startEnabled = Boolean(startHand?.enabled && seatedCount >= 2);
  const seatNotice = pokerStartHandNotice(notice);
  const legal = visiblePokerLegalActions(view);
  const layout = pokerActorLayout(legal);
  const fold = legal.find((a) => a.type === "FOLD");
  /** Seated dealer keeps the jeton tray during live betting streets (same anatomy as player). */
  const showTray = Boolean(ownerSeated && !compactDock && !showdown);
  const trayEnabled = Boolean(showTray && pokerTrayEnabled(view));

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
      {view.isOwner ? (
        <span className="pm-badge" data-owner-badge="true">
          OWNER
        </span>
      ) : null}
      <span className="pm-badge" data-dealer-badge="true">
        DEALER
      </span>
    </>
  );

  /** Prefer actor controls when this dealer is the current actor; else owner street/start. */
  let primary: { label: string; disabled?: boolean; title?: string; onClick?: () => void } | null = null;
  let secondary: { label: string; disabled?: boolean; onClick?: () => void } | null = null;
  let tertiary: { label: string; disabled?: boolean; onClick?: () => void } | null = null;

  if (showdown) {
    primary = null;
  } else if (layout.primary) {
    primary = {
      label: layout.primary.label,
      onClick: () =>
        void onCommand("pokerAct", {
          type: layout.primary!.type,
          amount: layout.primary!.amount.label,
        }),
    };
    if (fold) {
      secondary = {
        label: fold.label,
        onClick: () => void onCommand("pokerAct", { type: "FOLD", amount: "0" }),
      };
    }
    if (view.canDealStreet) {
      tertiary = {
        label: view.nextStreetLabel || "DEAL",
        onClick: () => void onCommand("advancePokerStreet"),
      };
    }
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
  if (showAdd && !secondary) {
    secondary = {
      label: "ADD PLAYER",
      onClick: () => setInviteOpen(true),
    };
  } else if (showAdd && secondary && !tertiary) {
    tertiary = {
      label: "ADD PLAYER",
      onClick: () => setInviteOpen(true),
    };
  }

  const turnHint =
    !setup && !showdown && phaseCopy.instruction
      ? phaseCopy.instruction
      : null;
  const dockNotice = seatNotice ?? notice ?? turnHint;

  return (
    <PremiumShell
      title="JETONBRO"
      badges={badges}
      board="POKER_DEALER"
      dock={
        <CasinoConsole
          variant={compactDock ? "setup" : "default"}
          notice={
            dockNotice ? (
              <div className="pm-console-notice" data-poker-turn-hint="true">
                {dockNotice}
              </div>
            ) : null
          }
          toCall={!compactDock && ownerSeated && view.toCall.label !== "0" ? view.toCall.label : null}
          available={!compactDock && !showdown && ownerSeated ? view.available.label : undefined}
          showTray={showTray}
          reserveTray={false}
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          onChip={(value) => {
            setSelectedChip(value);
            const act = pokerTrayChipAct(view, value);
            if (!act) return;
            void onCommand("pokerAct", { type: act.type, amount: act.amount });
          }}
          primary={primary}
          secondary={secondary}
          tertiary={tertiary}
        />
      }
    >
      <div className={`pm-poker-stage${showdown ? " is-payout" : ""}`}>
        <PokerTable
          tableName={view.tableName}
          instruction={setup ? phaseCopy.instruction : undefined}
          phase={view.phase}
          pot={view.pot.label}
          potMillis={view.pot.millis}
          pots={view.pots}
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
