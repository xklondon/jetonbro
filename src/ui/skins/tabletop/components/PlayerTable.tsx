"use client";

import { useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackPhaseCopy } from "@/ui/core/phase-copy";
import { blackjackOwnerMenu, blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { OwnerMenu } from "./OwnerMenu";
import { RankPadSheet } from "./primitives/HandCards";
import { PlayerBox } from "./primitives/PlayerBox";
import { TableButton } from "./primitives/TableButton";
import { BlackjackTableSurface } from "./primitives/BlackjackTableSurface";
import { BlackjackBoxStage, orderBoxesNewestLeft } from "./primitives/BlackjackBoxStage";
import { ownerChrome } from "./owner-chrome";
import { Wallet } from "./primitives/JetonTray";

/** Immersive Blackjack Player: owned boxes on the felt; tray anchored below. */
export function PlayerTable({
  view,
  selectedBoxId,
  onSelectBox,
  onCommand,
  notice,
  members = [],
}: {
  view: PlayerTableView;
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onCommand: CommandHandler;
  notice?: string | null;
  members?: MemberView[];
}) {
  const [exact, setExact] = useState("");
  const [hoverBoxId, setHoverBoxId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuView, setMenuView] = useState<"menu" | "dealer" | "session">("menu");
  const [cardPadOpen, setCardPadOpen] = useState(false);
  const [retractBusy, setRetractBusy] = useState<string | null>(null);

  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const controls = blackjackPlayerControls(view, selected);
  const playing = view.phase === "PLAYING";
  const payout = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.phase === "BETTING" || view.phase === "TABLE_SETUP" || view.phase === "ROUND_COMPLETE",
    changeGame: Boolean(view.canSwitchGame),
    insuranceOpen: view.insuranceWindowOpen,
    payoutResolved: view.phase === "ROUND_COMPLETE" || (payout && view.boxes.every((box) => box.outcome)),
  });
  const badges = view.isOwner
    ? ownerChrome(true, false, "BLACKJACK", ownerMenu, () => {
        setMenuView("dealer");
        setMenuOpen(true);
      }, () => {
        setMenuView("session");
        setMenuOpen(true);
      })
    : undefined;
  const staged = orderBoxesNewestLeft(view.boxes);
  const phaseCopy = blackjackPhaseCopy({
    role: view.isOwner ? "DEALER" : "PLAYER",
    phase: view.phase,
    insuranceOpen: view.insuranceWindowOpen,
  });
  const canEditCards = Boolean(playing && selected?.hand?.canEdit);
  const canUndo = Boolean(canEditCards && (selected?.hand?.ranks?.length ?? 0) > 0);

  function place(amount: string, boxId: string) {
    void onCommand("placeBet", { boxId, amount, mode: "ADD" });
  }

  async function retractBox(boxId: string, amount: string) {
    if (retractBusy || view.phase !== "BETTING" || !view.actions.retract) return;
    setRetractBusy(boxId);
    try {
      await onCommand("placeBet", { boxId, amount, mode: "RETRACT" });
    } finally {
      setRetractBusy(null);
    }
  }

  const rail = (
    <>
      <div className="tt-controls" data-game-controls="true">
        {notice ? <div className="tt-error">{notice}</div> : null}
        {view.bankLimitReached ? <div className="tt-error">Bank limit reached</div> : null}
        {controls.placeBet ? (
          <div className="tt-bet-row">
            <input
              type="text"
              className="tt-input"
              inputMode="decimal"
              placeholder="Amount"
              value={exact}
              onChange={(event) => setExact(event.target.value)}
              aria-label="Exact bet amount"
            />
            <TableButton
              variant="primary"
              disabled={!selected || !exact || selected.coverage?.bet === false}
              onClick={() => {
                if (!selected || !exact) return;
                void onCommand("placeBet", { boxId: selected.id, amount: exact, mode: "SET" });
                setExact("");
              }}
            >
              PLACE BET
            </TableButton>
          </div>
        ) : null}
        {playing ? (
          <div className="tt-play-row" data-play-controls="true">
            <TableButton
              variant="primary"
              data-player-action="double"
              disabled={!controls.double}
              onClick={() => selected && void onCommand("doubleBox", { boxId: selected.id })}
            >
              2×
            </TableButton>
            <TableButton
              variant="secondary"
              data-player-action="split"
              disabled={!controls.split}
              onClick={() => selected && void onCommand("splitBox", { boxId: selected.id })}
            >
              SPLIT
            </TableButton>
            <TableButton
              variant="secondary"
              data-player-action="insurance"
              disabled={!controls.insurance}
              onClick={() => {
                if (!selected || !controls.insurance) return;
                void onCommand("buyInsurance", { boxId: selected.id, amount: selected.insuranceMax.label });
              }}
            >
              INSURANCE
            </TableButton>
            <TableButton
              variant="compact"
              data-player-action="add-card"
              data-card-action="add"
              disabled={!canEditCards}
              onClick={() => setCardPadOpen(true)}
            >
              + CARD
            </TableButton>
            <TableButton
              variant="compact"
              data-player-action="undo-card"
              data-card-action="undo"
              disabled={!canUndo}
              onClick={() => selected && void onCommand("removeCard", { boxId: selected.id })}
            >
              UNDO
            </TableButton>
          </div>
        ) : null}
      </div>
      <Wallet
        available={view.available}
        trayEnabled={controls.trayEnabled}
        dropSelector="[data-drop-box]"
        onTap={(amount) => {
          if (!view.actions.bet || !selected) return;
          place(amount, selected.id);
        }}
        onDrop={(amount, targetId) => {
          if (!view.actions.bet) return;
          setHoverBoxId(null);
          place(amount, targetId);
        }}
        onHover={setHoverBoxId}
      />
      {selected ? (
        <RankPadSheet
          open={cardPadOpen && canEditCards}
          title={`Box ${selected.boxNumber}`}
          onClose={() => setCardPadOpen(false)}
          onAdd={(rank) => void onCommand("addCard", { boxId: selected.id, rank })}
        />
      ) : null}
    </>
  );

  return (
    <Shell
      hideBrand
      balance={view.available.label}
      badges={badges}
      onMenu={view.isOwner ? () => setMenuOpen(true) : undefined}
      rail={rail}
      feltClassName={`tt-bj-player${view.phase === "BETTING" ? " is-betting" : ""}`}
      feltProps={{
        "data-table-board": "BLACKJACK_PLAYER",
        "data-selected-box": selected?.id ?? "",
        "data-box-count": view.boxes.length,
      }}
      overlay={
        view.isOwner ? (
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
            addPlayer="full"
            giveJetons
            changeDealer={ownerMenu.changeDealer}
            switchGame={ownerMenu.changeGame}
            closePreview={view.closePreview}
            closeCopy={`Save remaining jetons and close ${view.tableName}?`}
            gameSession={view.gameSession}
            startView={menuView}
          />
        ) : null
      }
    >
      {view.isOwner ? (
        <div
          hidden
          data-owner-menu="true"
          data-owner-change-dealer={ownerMenu.changeDealer ? "true" : "false"}
          data-owner-change-game={ownerMenu.changeGame ? "true" : "false"}
        />
      ) : null}
      <BlackjackTableSurface
        tableName={view.tableName}
        anatomy="player"
        phaseLabel={phaseCopy.primary}
        phaseInstruction={phaseCopy.instruction}
        dealer={
          <header className="tt-bj-dealer-band-head">
            <span>DEALER</span>
            <strong>Dealer</strong>
          </header>
        }
      >
        <BlackjackBoxStage
          boxes={staged}
          footer={
            controls.addBox ? (
              <TableButton variant="ghost" className="tt-addbox" onClick={() => void onCommand("addBox")}>
                ADD BOX
              </TableButton>
            ) : null
          }
        >
          {staged.map((box) => {
            const isSelected = box.id === selected?.id;
            const showInsure = Boolean(view.insuranceWindowOpen && isSelected);
            return (
              <PlayerBox
                key={box.id}
                box={box}
                selected={isSelected}
                dropHighlight={hoverBoxId === box.id}
                onSelect={() => onSelectBox(box.id)}
                showCards={playing || payout}
                chipSize="lg"
                onRetract={
                  view.phase === "BETTING" && view.actions.retract
                    ? () => void retractBox(box.id, box.bet.label)
                    : undefined
                }
                retractBusy={retractBusy === box.id}
                insurancePanel={
                  showInsure ? (
                    <div className="tt-insure" data-insurance-panel="true" data-for-box={box.id}>
                      <span>
                        <small>MAX 50%</small> <strong>{box.insurance?.label ?? box.insuranceMax.label}</strong>
                      </span>
                      <TableButton
                        variant="compact"
                        disabled={!controls.insurance}
                        onClick={() => void onCommand("buyInsurance", { boxId: box.id, amount: box.insuranceMax.label })}
                      >
                        {box.insurance ? "PLACED" : "PLACE"}
                      </TableButton>
                    </div>
                  ) : null
                }
              />
            );
          })}
        </BlackjackBoxStage>
      </BlackjackTableSurface>
    </Shell>
  );
}
