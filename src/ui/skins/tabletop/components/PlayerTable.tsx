"use client";

import { useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackOwnerMenu, blackjackPlayerControls } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { OwnerMenu } from "./OwnerMenu";
import { DealerMark } from "./Spot";
import { PhaseDisplay } from "./primitives/PhaseDisplay";
import { PlayerBox } from "./primitives/PlayerBox";
import { TableButton } from "./primitives/TableButton";
import { TableName } from "./primitives/TableName";
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

  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const controls = blackjackPlayerControls(view, selected);
  const ownerMenu = blackjackOwnerMenu({
    isOwner: view.isOwner,
    phase: view.phase,
    changeDealer: view.phase === "BETTING",
    changeGame: Boolean(view.canSwitchGame),
  });
  const playing = view.phase === "PLAYING";
  const sorted = view.boxes.slice().sort((a, b) => a.boxNumber - b.boxNumber);
  const phaseDisplay =
    view.insuranceWindowOpen && playing
      ? "INSURANCE"
      : view.phase === "TABLE_SETUP"
        ? "SETUP"
        : view.phase === "ROUND_COMPLETE"
          ? "PAYOUT"
          : view.phase;

  function place(amount: string, boxId: string) {
    void onCommand("placeBet", { boxId, amount, mode: "ADD" });
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
              variant="secondary"
              disabled={!controls.retract || !selected}
              onClick={() => selected && void onCommand("placeBet", { boxId: selected.id, amount: selected.bet.label, mode: "RETRACT" })}
            >
              RETRACT
            </TableButton>
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
    </>
  );

  return (
    <Shell
      hideBrand
      balance={view.available.label}
      badges={view.isOwner ? ["OWNER"] : undefined}
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
            onClose={() => setMenuOpen(false)}
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
      <DealerMark />
      <PhaseDisplay
        display={phaseDisplay}
        label={controls.phaseLabel}
        instruction={controls.instruction && controls.instruction !== "Round complete" ? controls.instruction : undefined}
      />
      <TableName name={view.tableName} />
      <div className="tt-stage">
        <div className="tt-boxes" data-box-stage="true" data-count={Math.min(sorted.length, 4)}>
          {sorted.map((box) => {
            const isSelected = box.id === selected?.id;
            const showInsure = Boolean(view.insuranceWindowOpen && isSelected);
            return (
              <PlayerBox
                key={box.id}
                box={box}
                selected={isSelected}
                dropHighlight={hoverBoxId === box.id}
                onSelect={() => onSelectBox(box.id)}
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
        </div>
        {controls.addBox ? (
          <TableButton variant="ghost" className="tt-addbox" onClick={() => void onCommand("addBox")}>
            ADD BOX
          </TableButton>
        ) : null}
      </div>
    </Shell>
  );
}
