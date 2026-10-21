"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokerActPayload,
  pokerAggressionLabel,
  pokerControls,
  pokerDockTrio,
  pokerTrayChipAct,
  pokerTrayEnabled,
  pokerTrayMinAmount,
  visiblePokerLegalActions,
} from "@/application/queries/poker-controls";
import type { InvitationView, MemberView, PokerTableView } from "@/application/queries/views";
import { pokerPhaseCopy, pokerStartHandNotice } from "@/ui/core/phase-copy";
import type { CommandHandler } from "@/ui/skins/types";
import { PremiumCelebrationSettings } from "./PremiumCelebrationSettings";
import { PremiumGiveJetonsMask } from "./PremiumGiveJetonsMask";
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
  const liveStreet = !setup && !betweenHands && !showdown;
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [giveOpen, setGiveOpen] = useState(false);
  const [fxSettingsOpen, setFxSettingsOpen] = useState(false);
  const [selectedChip, setSelectedChip] = useState<string | null>("25");
  const controls = pokerControls(view);
  const startHand = controls.find((control) => control.id === "startHand");
  const nextHand = controls.find((control) => control.id === "nextHand");
  const giveJetons = controls.find((control) => control.id === "giveJetons");
  const seatedCount = view.seats.filter((seat) => Boolean(seat.userId)).length;
  const ownerSeated = view.seats.some((seat) => seat.userId === view.viewerId);
  const startEnabled = Boolean(startHand?.enabled && seatedCount >= 2);
  const seatNotice = pokerStartHandNotice(notice);
  const legal = visiblePokerLegalActions(view);
  const trio = pokerDockTrio(legal);
  /** Fixed tray through every Poker phase for seated dealer (and always reserve height). */
  const showTray = Boolean(ownerSeated);
  const trayEnabled = Boolean(ownerSeated && liveStreet && pokerTrayEnabled(view));
  const minChip = trayEnabled ? pokerTrayMinAmount(view) : null;
  const chipAct = selectedChip && trayEnabled ? pokerTrayChipAct(view, selectedChip) : null;

  useEffect(() => {
    if (!minChip || !selectedChip) return;
    if (Number(selectedChip) < minChip) {
      const next = ["5", "10", "25", "50", "100"].find((value) => Number(value) >= minChip) ?? null;
      if (next) setSelectedChip(next);
    }
  }, [minChip, selectedChip]);

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
        <button
          type="button"
          className="pm-badge is-action"
          data-owner-badge="true"
          aria-label="Table settings"
          onClick={() => setFxSettingsOpen(true)}
        >
          OWNER
        </button>
      ) : null}
      <span className="pm-badge" data-dealer-badge="true">
        DEALER
      </span>
    </>
  );

  /** Prefer full legal trio when seated dealer is acting; else owner street/start. */
  let primary: { label: string; disabled?: boolean; title?: string; onClick?: () => void } | null = null;
  let secondary: { label: string; disabled?: boolean; title?: string; onClick?: () => void } | null = null;
  let tertiary: { label: string; disabled?: boolean; title?: string; onClick?: () => void } | null = null;

  if (showdown) {
    primary = null;
  } else if (trio.respond || trio.fold || trio.aggression) {
    primary = trio.respond
      ? {
          label: trio.respond.label,
          onClick: () => void onCommand("pokerAct", pokerActPayload(trio.respond!)),
        }
      : null;
    secondary = trio.fold
      ? {
          label: trio.fold.label,
          onClick: () => void onCommand("pokerAct", { type: "FOLD", amount: "0" }),
        }
      : null;
    tertiary = trio.aggression
      ? {
          label: chipAct ? `${chipAct.type} ${chipAct.amount}` : pokerAggressionLabel(trio.aggression),
          disabled: !chipAct,
          title: chipAct ? undefined : "Select a legal chip amount",
          onClick: () => {
            if (!chipAct) return;
            void onCommand("pokerAct", { type: chipAct.type, amount: chipAct.amount });
          },
        }
      : view.canDealStreet
        ? {
            label: view.nextStreetLabel || "DEAL",
            onClick: () => void onCommand("advancePokerStreet"),
          }
        : null;
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
  const showGive = Boolean(giveJetons && (setup || betweenHands));
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
  if (showGive && !tertiary) {
    tertiary = {
      label: "BUY-IN",
      onClick: () => setGiveOpen(true),
    };
  } else if (showGive && !secondary) {
    secondary = {
      label: "BUY-IN",
      onClick: () => setGiveOpen(true),
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
          variant="default"
          notice={
            dockNotice ? (
              <div className="pm-console-notice" data-poker-turn-hint="true">
                {dockNotice}
              </div>
            ) : null
          }
          toCall={liveStreet && ownerSeated && view.toCall.label !== "0" ? view.toCall.label : null}
          available={ownerSeated ? view.available.label : undefined}
          showTray={showTray}
          reserveTray={Boolean(ownerSeated)}
          trayEnabled={trayEnabled}
          selectedChip={selectedChip}
          minChipAmount={minChip}
          onChip={(value) => setSelectedChip(value)}
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
      <PremiumGiveJetonsMask
        open={giveOpen}
        onClose={() => setGiveOpen(false)}
        members={members}
        onCommand={onCommand}
        title="BUY-IN"
        notice={notice}
      />
      <PremiumCelebrationSettings
        open={fxSettingsOpen}
        onClose={() => setFxSettingsOpen(false)}
        prefs={view.outcomeFx}
        onCommand={onCommand}
      />
    </PremiumShell>
  );
}
