"use client";

import { useState } from "react";
import type { BoxView, MemberView, PlayerTableView } from "@/application/queries/views";
import { blackjackOwnerMenu, blackjackPlayerControls, playerBoxSlots } from "@/ui/core/blackjack-phase-controls";
import type { CommandHandler } from "@/ui/skins/types";
import { Shell } from "./Shell";
import { Wallet } from "./Tray";
import { OwnerMenu } from "./OwnerMenu";
import { ChipPile, ClothName, DealerMark, PhasePill } from "./Spot";

function resultCopy(box: BoxView): { kind: string; text: string } | null {
  if (!box.outcome) return null;
  if (box.outcome === "WON") return { kind: "won", text: box.returned ? `WON +${box.returned.label}` : "WON" };
  if (box.outcome === "LOST") return { kind: "lost", text: box.returned && box.returned.label !== "0" ? `LOST ${box.returned.label}` : "LOST" };
  if (box.outcome === "PUSH") return { kind: "push", text: box.returned ? `STAND OFF ${box.returned.label}` : "STAND OFF" };
  return { kind: "blackjack", text: box.returned ? `BLACKJACK +${box.returned.label}` : "BLACKJACK" };
}

function insuranceCopy(result: string | null): string | null {
  if (!result) return null;
  if (/LOST/i.test(result)) return "INS LOST";
  if (/WON/i.test(result)) {
    const returned = result.match(/return ([0-9.]+)/)?.[1];
    return returned ? `INS WON +${returned}` : "INS WON";
  }
  return result;
}

/** Immersive Blackjack Player: the Player's own boxes sit on the felt between the dealer mark and the tray. */
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
  const { slots, extras } = playerBoxSlots(sorted);
  const arc = sorted.length === 3 && extras.length === 0 && slots.every(Boolean);
  const arranged: BoxView[] = arc ? (slots as BoxView[]) : sorted;
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
            <button
              className="tt-btn"
              type="button"
              disabled={!controls.retract || !selected}
              onClick={() => selected && void onCommand("placeBet", { boxId: selected.id, amount: selected.bet.label, mode: "RETRACT" })}
            >
              RETRACT
            </button>
            <button
              className="tt-btn gold"
              type="button"
              disabled={!selected || !exact || selected.coverage?.bet === false}
              onClick={() => {
                if (!selected || !exact) return;
                void onCommand("placeBet", { boxId: selected.id, amount: exact, mode: "SET" });
                setExact("");
              }}
            >
              PLACE BET
            </button>
          </div>
        ) : null}
        {playing ? (
          <div className="tt-play-row" data-play-controls="true">
            <button
              type="button"
              className="tt-btn gold"
              data-player-action="double"
              disabled={!controls.double}
              onClick={() => selected && void onCommand("doubleBox", { boxId: selected.id })}
            >
              2×
            </button>
            <button
              type="button"
              className="tt-btn"
              data-player-action="split"
              disabled={!controls.split}
              onClick={() => selected && void onCommand("splitBox", { boxId: selected.id })}
            >
              SPLIT
            </button>
            <button
              type="button"
              className="tt-btn"
              data-player-action="insurance"
              disabled={!controls.insurance}
              onClick={() => {
                if (!selected || !controls.insurance) return;
                void onCommand("buyInsurance", { boxId: selected.id, amount: selected.insuranceMax.label });
              }}
            >
              INSURANCE
            </button>
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
      <PhasePill display={phaseDisplay} label={controls.phaseLabel} instruction={controls.instruction && controls.instruction !== "Round complete" ? controls.instruction : undefined} />
      <ClothName name={view.tableName} />
      <div className="tt-stage">
        <div className="tt-boxes" data-box-stage="true" data-count={Math.min(sorted.length, 4)} data-arc={arc ? "true" : undefined}>
          {arranged.map((box) => {
            const result = resultCopy(box);
            const isSelected = box.id === selected?.id;
            const status = result ? null : box.isDoubled ? "Doubled" : box.isSplit ? "Split" : null;
            const insured = box.insurance || box.insuranceResult;
            const showInsure = Boolean(view.insuranceWindowOpen && isSelected);
            return (
              <div className="tt-box-wrap" key={box.id} data-slot={box.boxNumber}>
                <div
                  className={`tt-box${isSelected ? " selected" : ""}${hoverBoxId === box.id ? " drop-target" : ""}${result ? ` is-${result.kind} is-payout` : ""}`}
                  data-drop-box={box.id}
                  data-box-id={box.id}
                  data-box-slot={box.boxNumber}
                  data-payout-box={result ? "true" : undefined}
                  role="button"
                  aria-label={box.label}
                  aria-pressed={isSelected}
                  tabIndex={0}
                  onClick={() => onSelectBox(box.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectBox(box.id);
                    }
                  }}
                >
                  <span className="tt-box-name">BOX {box.boxNumber}</span>
                  {result ? (
                    <span className="tt-box-payout" data-payout-main="true">
                      <strong className="tt-amount">{box.returned?.label ?? box.bet.label}</strong>
                      <em className={`tt-result is-${result.kind}`} data-payout-state={box.outcome ?? ""}>
                        {result.text}
                      </em>
                    </span>
                  ) : (
                    <>
                      <ChipPile millis={box.bet.millis} />
                      <span className="tt-amount">{box.bet.label}</span>
                    </>
                  )}
                  {insured ? (
                    <span className="tt-box-ins" data-payout-insurance={box.insuranceResult ? "true" : undefined} data-insurance-result={box.insuranceResult ?? ""}>
                      INS {box.insurance?.label ?? "—"}
                      {box.insuranceResult ? ` · ${insuranceCopy(box.insuranceResult)}` : ""}
                    </span>
                  ) : null}
                  {status ? <span className="tt-box-status">{status}</span> : null}
                </div>
                {showInsure ? (
                  <div className="tt-insure" data-insurance-panel="true" data-for-box={box.id}>
                    <span>
                      <small>MAX 50%</small> <strong>{box.insurance?.label ?? box.insuranceMax.label}</strong>
                    </span>
                    <button
                      type="button"
                      disabled={!controls.insurance}
                      onClick={() => void onCommand("buyInsurance", { boxId: box.id, amount: box.insuranceMax.label })}
                    >
                      {box.insurance ? "PLACED" : "PLACE"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {controls.addBox ? (
          <button className="tt-addbox" type="button" onClick={() => void onCommand("addBox")}>
            ADD BOX
          </button>
        ) : null}
      </div>
    </Shell>
  );
}
