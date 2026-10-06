"use client";

import { useEffect, useMemo, useState } from "react";
import {
  pokerActorLayout,
  pokerComposeBounds,
  pokerComposeSeed,
  pokerControlIds,
  pokerControls,
  pokerTrayEnabled,
  pokerTurnLabel,
  visiblePokerLegalActions,
  type PokerComposeKind,
} from "@/application/queries/poker-controls";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { addChipToAmount } from "@/ui/core/poker-chip-action";
import type { CommandHandler } from "@/ui/skins/types";
import { communityCardLimit } from "@/domain/poker/cards";
import { Shell } from "./Shell";
import { Sheet } from "./Sheet";
import { OwnerMenu, type OwnerMenuItem } from "./OwnerMenu";
import { PokerCardSheet } from "./PokerCardSheet";
import { PokerActionDock } from "./primitives/PokerActionDock";
import { PokerAwardControl, PokerHandComplete } from "./primitives/PokerAward";
import { PokerPot, PokerStreet } from "./primitives/PokerPot";
import { PokerSeat, pokerSeatPosition } from "./primitives/PokerSeat";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { TableName } from "./primitives/TableName";
import { ownerChrome } from "./owner-chrome";
import { Wallet } from "./primitives/JetonTray";

function phaseHeading(phase: string, label: string): string {
  if (phase === "POKER_SETUP") return "POKER SETUP";
  return (label || phase).replaceAll("_", " ");
}

/**
 * Shared Poker felt. Owner gets street controls in the rail and the table menu;
 * Player gets the same felt with actor actions and the wallet only.
 */
export function PokerBoard({
  view,
  members = [],
  onCommand,
  notice,
  owner,
}: {
  view: PokerTableView;
  members?: MemberView[];
  onCommand: CommandHandler;
  notice?: string | null;
  owner: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"menu" | "dealer" | "session">("menu");
  const [cards, setCards] = useState<"hole" | "board" | null>(null);
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const [compose, setCompose] = useState<PokerComposeKind | null>(null);
  const [staged, setStaged] = useState("");
  const [busy, setBusy] = useState(false);
  const ownHole = view.seats.find((seat) => seat.userId === view.viewerId)?.holeCards ?? [];
  const showCardMenu = Boolean(view.canEditHole || view.canEditCommunity);

  useEffect(() => {
    setCompose(null);
    setStaged("");
    setBusy(false);
  }, [view.turnNumber, view.currentActorId]);

  useEffect(() => {
    if (view.phase !== "SHOWDOWN") setWinners({});
  }, [view.phase, view.handNumber]);

  const layout = pokerActorLayout(visiblePokerLegalActions(view));
  const menuIds = owner ? pokerControlIds(view, "owner", "menu") : [];
  const ownerDock = owner ? pokerControls(view).filter((control) => control.layer === "owner" && control.surface === "dock") : [];
  const turn =
    view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" || view.phase === "POKER_SETUP"
      ? null
      : pokerTurnLabel(view.waitingCopy);
  const viewerIndex = view.seats.findIndex((seat) => seat.userId === view.viewerId);
  const showActions = Boolean(layout.primary || layout.secondary.length > 0);
  const winnerPayload = useMemo(
    () => JSON.stringify(view.pots.map((pot) => ({ index: pot.index, winnerIds: winners[pot.index] ?? pot.winnerPlayerIds }))),
    [view.pots, winners],
  );

  function send(type: string, payload: Record<string, string> = {}) {
    if (busy) return;
    setBusy(true);
    void onCommand("pokerAct", { type, ...payload });
  }

  function openCompose(kind: PokerComposeKind) {
    setCompose(kind);
    setStaged(pokerComposeSeed(view, kind));
  }

  function stageChip(amount: string) {
    const kind = compose ?? (view.legalActions.some((action) => action.type === "BET") ? "BET" : "RAISE");
    if (!view.legalActions.some((action) => action.type === kind)) return;
    setCompose(kind);
    setStaged((current) => addChipToAmount(compose ? current : "0", amount));
  }

  function confirmCompose() {
    if (!compose || busy || !/^\d+$/.test(staged.trim())) return;
    const bounds = pokerComposeBounds(view, compose);
    const requested = BigInt(staged.trim()) * 1000n;
    if (requested < bounds.minMillis && requested < bounds.maxMillis) return;
    send(compose, { amount: requested > bounds.maxMillis ? bounds.max : staged.trim() });
  }

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

  function confirmAward() {
    void onCommand("awardPokerPots", { pots: winnerPayload });
  }

  const canAddBesideStart = owner && view.canAddPlayer && view.phase === "POKER_SETUP";

  const ownerZone =
    ownerDock.length > 0 || canAddBesideStart || (owner && view.canAward) ? (
      <div className="tt-owner-zone" data-owner-controls="true">
        {owner && view.canAward ? (
          <PokerAwardControl
            view={view}
            winners={winners}
            onToggle={toggleWinner}
            onConfirm={confirmAward}
            onClose={() => setWinners({})}
          />
        ) : (
          <div className="tt-owner-row">
            {ownerDock.map((control) => {
              if (control.id === "assignWinners") return null;
              if (control.id === "dealStreet") {
                return (
                  <div key={control.id} className="tt-owner-street">
                    <button
                      type="button"
                      className={`tt-btn${control.enabled ? " gold" : ""}`}
                      disabled={!control.enabled}
                      onClick={() => void onCommand("advancePokerStreet")}
                    >
                      {control.label}
                    </button>
                    {control.hint ? <small className="tt-muted">{control.hint}</small> : null}
                  </div>
                );
              }
              if (control.id === "startHand") {
                return (
                  <button
                    key={control.id}
                    type="button"
                    className="tt-btn gold"
                    disabled={!control.enabled}
                    onClick={() => void onCommand("startTexasHoldem")}
                  >
                    {control.label}
                  </button>
                );
              }
              if (control.id === "nextHand") {
                return (
                  <button key={control.id} type="button" className="tt-btn gold" onClick={() => void onCommand("startNextPokerHand")}>
                    {control.label}
                  </button>
                );
              }
              return null;
            })}
            {canAddBesideStart ? (
              <button type="button" className="tt-btn" data-add-player-dock="true" onClick={() => setMenuOpen(true)}>
                ADD PLAYER
              </button>
            ) : null}
          </div>
        )}
      </div>
    ) : null;

  const rail = (
    <>
      {ownerZone}
      {notice || showActions || turn ? (
        <div className="tt-controls" data-game-controls="true">
          {notice ? <div className="tt-error">{notice}</div> : null}
          {!showActions && turn ? (
            <div
              className={`tt-turn-banner${turn.you ? " is-you" : ""}`}
              data-turn-banner={turn.you ? "you" : "other"}
              data-turn-state={turn.you ? "you" : "other"}
            >
              {turn.you ? "YOUR TURN" : `TURN · ${view.currentActorName ?? "Player"}`}
            </div>
          ) : null}
          {showActions ? (
            <PokerActionDock
              view={view}
              layout={layout}
              compose={compose}
              staged={staged}
              busy={busy}
              onAction={(type) => send(type)}
              onOpenCompose={openCompose}
              onStageChange={setStaged}
              onConfirm={confirmCompose}
              onClear={() => setStaged("")}
              onCancel={() => {
                setCompose(null);
                setStaged("");
              }}
            />
          ) : null}
        </div>
      ) : null}
      <Wallet
        available={view.available}
        trayEnabled={pokerTrayEnabled(view)}
        dropSelector="[data-drop-pot]"
        onTap={stageChip}
        onDrop={(amount) => stageChip(amount)}
      />
    </>
  );

  const menuItems: OwnerMenuItem[] = [];
  if (menuIds.includes("scheduleNextHand")) {
    menuItems.push({ label: "NEXT HAND IN 7 SECONDS", onClick: () => void onCommand("scheduleNextPokerHand") });
  }
  if (view.canEditHole) {
    menuItems.push({
      label: "+ HOLE CARDS",
      onClick: () => {
        setMenuOpen(false);
        setCards("hole");
      },
    });
  }
  if (view.canEditCommunity) {
    menuItems.push({
      label: "+ BOARD CARDS",
      onClick: () => {
        setMenuOpen(false);
        setCards("board");
      },
    });
  }

  const pokerSafe = view.phase === "POKER_SETUP" || view.phase === "HAND_COMPLETE";
  const badges = owner
    ? ownerChrome(view.isOwner, owner, "POKER", { changeDealer: view.isOwner && pokerSafe, changeGame: menuIds.includes("switchGame") && pokerSafe }, () => {
        setMenuView("dealer");
        setMenuOpen(true);
      }, () => {
        setMenuView("session");
        setMenuOpen(true);
      })
    : undefined;

  return (
    <Shell
      hideBrand
      badges={badges}
      onMenu={owner || showCardMenu ? () => setMenuOpen(true) : undefined}
      rail={rail}
      feltClassName="tt-poker"
      feltProps={{
        "data-table-board": owner ? "POKER_DEALER" : "POKER_PLAYER",
        "data-card-editor": cards ? "open" : "closed",
        "data-seat-count": view.seats.length,
        "data-poker-phase": view.phase,
      }}
      overlay={
        <>
          {owner ? (
            <OwnerMenu
              open={menuOpen}
              onClose={() => {
                setMenuOpen(false);
                setMenuView("menu");
              }}
              tableName={view.tableName}
              members={members}
              onCommand={onCommand}
              game="POKER"
              items={menuItems}
              addPlayer={menuIds.includes("addPlayer") ? "full" : false}
              giveJetons={menuIds.includes("giveJetons")}
              changeDealer
              switchGame={menuIds.includes("switchGame")}
              seats={menuIds.includes("reorderSeats") ? view.seats : null}
              seatsHint="Dealer button follows this order after START HAND. Order locks when the first hand begins."
              closeCopy={`Save each Player’s remaining jetons to their personal ledger and close ${view.tableName}?`}
              gameSession={view.gameSession}
              startView={menuView}
            />
          ) : showCardMenu ? (
            <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} labelledBy="tt-poker-tools-title" className="invite-mask">
              <header className="tt-sheet-head">
                <h3 id="tt-poker-tools-title">Table</h3>
                <button className="tt-link" type="button" onClick={() => setMenuOpen(false)}>
                  Cancel
                </button>
              </header>
              <div className="tt-label">OPTIONAL TOOLS</div>
              <div className="tt-menu-list">
                {view.canEditHole ? (
                  <button
                    type="button"
                    className="tt-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      setCards("hole");
                    }}
                  >
                    + HOLE CARDS
                  </button>
                ) : null}
                {view.canEditCommunity ? (
                  <button
                    type="button"
                    className="tt-btn"
                    onClick={() => {
                      setMenuOpen(false);
                      setCards("board");
                    }}
                  >
                    + BOARD CARDS
                  </button>
                ) : null}
                {!view.canEditHole && !view.canEditCommunity ? (
                  <p className="tt-muted">Card Assist stays off the felt. Open this menu during a live hand to enter optional ranks.</p>
                ) : null}
              </div>
            </Sheet>
          ) : null}
          {cards === "board" ? (
            <PokerCardSheet
              title="Board cards"
              cards={view.communityCards}
              max={communityCardLimit(view.phase)}
              onSave={(next) => void onCommand("setPokerCommunityCards", { cards: JSON.stringify(next) })}
              onClose={() => setCards(null)}
            />
          ) : null}
          {cards === "hole" ? (
            <PokerCardSheet
              title="Hole cards"
              cards={ownHole}
              max={2}
              onSave={(next) => void onCommand("setPokerHoleCards", { cards: JSON.stringify(next) })}
              onClose={() => setCards(null)}
            />
          ) : null}
        </>
      }
    >
      <div className="tt-poker-top">
        <PhaseDisplay label={phaseHeading(view.phase, view.phaseLabel)} />
        {turn && showActions ? (
          <span className={`tt-turn${turn.you ? " is-you" : ""}`} data-turn-state={turn.you ? "you" : "other"}>
            {turn.label}
          </span>
        ) : null}
        <PokerStreet view={view} />
      </div>
      <div className="tt-poker-table" data-seat-layout={view.seats.length <= 2 ? "heads-up" : view.seats.length <= 4 ? "mid" : "full"}>
        <div className="tt-poker-oval" aria-hidden="true" />
        <div className="tt-poker-felt-name">
          <TableName name={view.tableName} />
        </div>
        <PokerPot view={view} />
        <PokerHandComplete view={view} />
        {view.seats.map((seat, index) => (
          <PokerSeat
            key={seat.userId}
            seat={seat}
            view={view}
            index={index}
            style={pokerSeatPosition(index, view.seats.length, viewerIndex)}
          />
        ))}
      </div>
    </Shell>
  );
}
