"use client";

import { useState, type ReactNode } from "react";
import type { BankTableView, BoxView, MemberView } from "@/application/queries/views";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import { blackjackDealerControls, blackjackOwnerMenu } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { InviteMask } from "./InviteMask";
import { OwnerMenu, type OwnerMenuItem } from "./OwnerMenu";
import { ownerChrome } from "./owner-chrome";
import { Countdown } from "./Spot";
import { ActionDock } from "./primitives/ActionDock";
import { DealerLedger, DealerLedgerRow } from "./primitives/DealerLedger";
import { DealerHandPanel } from "./primitives/HandCards";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { TableName } from "./primitives/TableName";

/** Collect every active box instance — one row each; never aggregate by Player. */
function activeBoxes(view: BankTableView): BoxView[] {
  const fromPlayers = view.players.flatMap((player) => player.boxes);
  if (fromPlayers.length > 0) return fromPlayers;
  return view.boxes;
}

function boxesReady(view: BankTableView) {
  const boxes = activeBoxes(view);
  if (boxes.length === 0) return view.phase === "ROUND_COMPLETE";
  return boxes.every((box) => Boolean(box.outcome));
}

/** Immersive Blackjack Dealer: dense ledger for real boxes; actions in the rail. */
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [menuView, setMenuView] = useState<"menu" | "dealer" | "session">("menu");
  const controls = blackjackDealerControls(view);
  const payoutResolved = boxesReady(view);
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.actions.changeBank,
    changeGame: view.actions.switchGame || Boolean(view.canSwitchGame),
    insuranceOpen: view.insurance.window === "OPEN",
    payoutResolved,
  });
  const badges = ownerChrome(view.isOwner, true, "BLACKJACK", ownerMenu, () => {
    setMenuView("dealer");
    setMenuOpen(true);
  }, () => {
    setMenuView("session");
    setMenuOpen(true);
  });
  const phaseCopy = blackjackPhaseCopy({
    role: "DEALER",
    phase: view.phase,
    insuranceOpen: view.insurance.window === "OPEN",
  });
  const boxes = activeBoxes(view);
  const showDealerHand =
    view.phase === "PLAYING" || view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE" || view.phase === "BETTING";
  const dealerCanEdit = Boolean(view.dealerHand?.canEdit);

  const settle = (box: BoxView) => (outcome: BoxOutcome) => void onCommand("settleBox", { boxId: box.id, outcome });

  const rows: ReactNode[] = boxes.map((box) => (
    <DealerLedgerRow
      key={box.id}
      box={box}
      phase={view.phase}
      payoutEnabled={view.actions.settleBoxes}
      insuranceSettleEnabled={view.actions.settleInsurance}
      onSettle={settle(box)}
      onSettleInsurance={(resolution) => void onCommand("settleInsurance", { resolution })}
      dealerMayCorrect={view.phase === "PLAYING"}
      onAddCard={(boxId, rank) => void onCommand("addCard", { boxId, rank })}
      onUndoCard={(boxId) => void onCommand("removeCard", { boxId })}
    />
  ));

  const menuItems: OwnerMenuItem[] = [];
  if (view.phase === "BETTING") {
    menuItems.push({ label: "DEAL IN 7 SECONDS", disabled: !view.actions.scheduleDeal, onClick: () => void onCommand("scheduleDeal") });
  }
  if (view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE") {
    menuItems.push({ label: "IN 7 SECONDS", disabled: !view.actions.scheduleNextRound, onClick: () => void onCommand("scheduleNextRound") });
  }

  const summary = showDealerHand ? (
    <DealerHandPanel
      hand={view.dealerHand}
      canEdit={dealerCanEdit}
      onAdd={(rank) => void onCommand("addCard", { dealer: "true", rank })}
      onUndo={() => void onCommand("removeCard", { dealer: "true" })}
    />
  ) : null;

  const dock = (
    <ActionDock
      notice={notice ? <div className="tt-error">{notice}</div> : null}
      primary={
        controls.primary
          ? {
              label: controls.primary.label,
              disabled: !controls.primary.enabled,
              onClick: () => void onCommand(controls.primary!.command),
            }
          : null
      }
      secondary={
        controls.showAddPlayer
          ? { label: "ADD PLAYER", addPlayer: true, onClick: () => setInviteOpen(true) }
          : controls.insurance
            ? {
                label: controls.insurance.label,
                disabled: !controls.insurance.enabled,
                onClick: () => void onCommand(controls.insurance!.command),
              }
            : null
      }
    />
  );

  return (
    <Shell
      hideBrand
      badges={badges}
      onMenu={() => setMenuOpen(true)}
      rail={dock}
      feltClassName="tt-bj-dealer"
      feltProps={{
        "data-table-board": "BLACKJACK_DEALER",
        "data-guest-join-url": view.guestJoinUrl ?? undefined,
        "data-verified-join-url": view.verifiedJoinUrl ?? undefined,
        "data-box-count": boxes.length,
      }}
      overlay={
        <>
          <InviteMask
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            guestJoinUrl={view.guestJoinUrl}
            verifiedJoinUrl={view.verifiedJoinUrl}
            emailConfigured={view.emailConfigured !== false}
            startingJetons={view.startingJetons?.label ?? "100"}
            members={members}
            invitations={view.invitations}
            onCommand={onCommand}
            notice={notice}
          />
          <OwnerMenu
            open={menuOpen}
            onClose={() => {
              setMenuOpen(false);
              setMenuView("menu");
            }}
            tableName={view.tableName}
            members={members}
            onCommand={onCommand}
            game="BLACKJACK"
            items={menuItems}
            addPlayer={view.phase === "BETTING" ? "invite" : view.isOwner && view.actions.addPlayer ? "full" : false}
            onInvite={() => setInviteOpen(true)}
            giveJetons={view.actions.giveJetons}
            rename={view.isOwner}
            changeDealer={ownerMenu.changeDealer}
            switchGame={ownerMenu.changeGame}
            dealerWon={view.actions.settleDealerWon}
            bankroll={view.phase === "BETTING" ? (view.bankroll ?? null) : null}
            cardAssist={view.cardAssist ?? "OFF"}
            lifecycle={view.isOwner}
            canSave={view.actions.saveTable}
            canClose={view.actions.closeTable}
            closePreview={view.closePreview}
            gameSession={view.gameSession}
            startView={menuView}
          />
        </>
      }
    >
      <div
        hidden
        data-owner-menu="true"
        data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
        data-owner-change-game={ownerMenu.changeGame ? "true" : "false"}
      />
      <PhaseDisplay label={phaseCopy.primary} instruction={controls.instruction || undefined} />
      <TableName name={view.tableName} />
      {view.bettingCloseDeadlineAt || view.nextRoundDeadlineAt ? (
        <div className="tt-timers">
          <Countdown deadline={view.bettingCloseDeadlineAt} label="Cards in" />
          <Countdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
        </div>
      ) : null}
      {view.insurance.window === "OPEN" || view.insurance.count > 0 ? (
        <div className="tt-ins-pot" data-insurance-pot="true">
          INSURANCE · {view.insurance.total.label} · {view.insurance.count} {view.insurance.count === 1 ? "bet" : "bets"}
        </div>
      ) : null}
      <DealerLedger
        playerCount={view.players.length}
        boxCount={boxes.length}
        summary={summary}
        payoutMode={view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE"}
      >
        {rows}
      </DealerLedger>
    </Shell>
  );
}
