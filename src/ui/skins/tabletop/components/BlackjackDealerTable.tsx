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
import { DealerHandPanel } from "./primitives/HandCards";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { PlayerBox } from "./primitives/PlayerBox";
import { ResultControls } from "./primitives/DealerLedger";
import { TableButton } from "./primitives/TableButton";
import { TableName } from "./primitives/TableName";

/** Collect every active box instance — one felt box each; never aggregate by Player. */
export function activeDealerBoxes(view: BankTableView): BoxView[] {
  const fromPlayers = view.players.flatMap((player) => player.boxes);
  if (fromPlayers.length > 0) return fromPlayers;
  return view.boxes;
}

function boxesReady(view: BankTableView) {
  const boxes = activeDealerBoxes(view);
  if (boxes.length === 0) return view.phase === "ROUND_COMPLETE" || view.phase === "TABLE_SETUP";
  return boxes.every((box) => Boolean(box.outcome));
}

/**
 * Canonical Tabletop Blackjack Dealer surface for every phase including TABLE_SETUP.
 * Phase changes alter labels/values/controls — not felt geometry or Dealer slot presence.
 */
export function BlackjackDealerTable({
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
  const setup = view.phase === "TABLE_SETUP";
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.actions.changeBank || setup,
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
  const boxes = activeDealerBoxes(view);
  const waitingPlayers = setup
    ? view.players.filter((player) => player.boxes.length === 0)
    : [];
  const dealerCanEdit = Boolean(view.dealerHand?.canEdit);
  const payoutPhase = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const showCards = view.phase === "PLAYING" || payoutPhase;

  const settle = (box: BoxView) => (outcome: BoxOutcome) => void onCommand("settleBox", { boxId: box.id, outcome });

  const menuItems: OwnerMenuItem[] = [];
  if (view.phase === "BETTING") {
    menuItems.push({ label: "DEAL IN 7 SECONDS", disabled: !view.actions.scheduleDeal, onClick: () => void onCommand("scheduleDeal") });
  }
  if (payoutPhase) {
    menuItems.push({ label: "IN 7 SECONDS", disabled: !view.actions.scheduleNextRound, onClick: () => void onCommand("scheduleNextRound") });
  }

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

  const emptySlots = setup && boxes.length === 0 && waitingPlayers.length === 0 ? 2 : 0;
  const stageCount = Math.min(Math.max(boxes.length || waitingPlayers.length || emptySlots, 1), 4);

  const boxNodes: ReactNode[] =
    boxes.length > 0
      ? boxes.map((box) => {
          const unresolved = Boolean(controls.showPayoutResults && !box.outcome);
          const showInsSettle = Boolean(
            controls.showInsuranceSettle && box.insurance && !box.insuranceResult,
          );
          return (
            <div key={box.id} className="tt-bj-box-slot" data-dealer-box-slot={box.boxNumber} data-settle-box={box.id}>
              <PlayerBox
                box={box}
                showCards={showCards}
                showPlayerName
                chipSize="lg"
                status={box.isDoubled ? "2×" : box.isSplit ? "Split" : null}
              />
              {unresolved ? (
                <div className="tt-bj-box-settle" data-payout-controls="true">
                  <ResultControls box={box} onSettle={settle(box)} />
                  {showInsSettle ? (
                    <span className="tt-ledger-ins-results" role="group" aria-label={`Settle insurance · Box ${box.boxNumber}`}>
                      <TableButton
                        variant="compact"
                        className="ins-win"
                        data-insurance-action="won"
                        onClick={() => void onCommand("settleInsurance", { resolution: "DEALER_BLACKJACK" })}
                      >
                        INS WON
                      </TableButton>
                      <TableButton
                        variant="compact"
                        className="ins-lose"
                        data-insurance-action="lost"
                        onClick={() => void onCommand("settleInsurance", { resolution: "NO_DEALER_BLACKJACK" })}
                      >
                        INS LOST
                      </TableButton>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })
      : waitingPlayers.length > 0
        ? waitingPlayers.map((player, index) => (
            <PlayerBox
              key={player.userId}
              empty
              emptyLabel={player.name}
              emptySlot={index + 1}
              showPlayerName
            />
          ))
        : Array.from({ length: emptySlots }, (_, index) => (
            <PlayerBox key={`empty-${index}`} empty emptySlot={index + 1} emptyLabel="Open seat" />
          ));

  return (
    <Shell
      hideBrand
      badges={badges}
      onMenu={() => setMenuOpen(true)}
      rail={dock}
      feltClassName="tt-bj-dealer"
      feltProps={{
        "data-table-board": "BLACKJACK_DEALER",
        "data-bj-phase": view.phase,
        "data-guest-join-url": view.guestJoinUrl ?? undefined,
        "data-verified-join-url": view.verifiedJoinUrl ?? undefined,
        "data-box-count": boxes.length,
        "data-centre-divider": "absent",
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
            addPlayer={
              setup || view.phase === "BETTING"
                ? "invite"
                : view.isOwner && view.actions.addPlayer
                  ? "full"
                  : false
            }
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
      <PhaseDisplay
        label={phaseCopy.primary}
        instruction={
          setup
            ? phaseCopy.instruction
            : controls.instruction || undefined
        }
      />
      <div className="tt-bj-felt" data-bj-felt="true" data-bj-anatomy="dealer">
        <TableName name={view.tableName} />
        {view.bettingCloseDeadlineAt || view.nextRoundDeadlineAt ? (
          <div className="tt-timers">
            <Countdown deadline={view.bettingCloseDeadlineAt} label="Cards in" />
            <Countdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
          </div>
        ) : null}
        <div
          className={`tt-ins-pot${view.insurance.window === "OPEN" || view.insurance.count > 0 ? " is-active" : " is-quiet"}`}
          data-insurance-pot={view.insurance.window === "OPEN" || view.insurance.count > 0 ? "true" : "reserved"}
          aria-hidden={view.insurance.window === "OPEN" || view.insurance.count > 0 ? undefined : true}
        >
          {view.insurance.window === "OPEN" || view.insurance.count > 0
            ? `INSURANCE · ${view.insurance.total.label} · ${view.insurance.count} ${view.insurance.count === 1 ? "bet" : "bets"}`
            : "\u00a0"}
        </div>
        <section className="tt-bj-dealer-slot" data-dealer-slot="true" aria-label="Dealer">
          <header className="tt-bj-dealer-slot-head">
            <span>DEALER</span>
            <strong>{view.dealerName || "Dealer"}</strong>
          </header>
          <div className="tt-bj-dealer-slot-body">
            <DealerHandPanel
              hand={view.dealerHand}
              canEdit={dealerCanEdit}
              onAdd={(rank) => void onCommand("addCard", { dealer: "true", rank })}
              onUndo={() => void onCommand("removeCard", { dealer: "true" })}
            />
          </div>
        </section>
        <div className="tt-stage tt-bj-stage">
          <div className="tt-boxes" data-box-stage="true" data-count={stageCount} data-dealer-boxes="true">
            {boxNodes}
          </div>
        </div>
      </div>
    </Shell>
  );
}
