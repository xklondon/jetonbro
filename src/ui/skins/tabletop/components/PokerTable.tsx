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
  type PokerActorLayout,
  type PokerComposeKind,
} from "@/application/queries/poker-controls";
import type { MemberView, PokerLegalActionView, PokerSeatView, PokerTableView } from "@/application/queries/views";
import { addChipToAmount } from "@/ui/core/poker-chip-action";
import type { CommandHandler } from "@/ui/skins/types";
import { communityCardLimit } from "@/domain/poker/cards";
import { Shell } from "./Shell";
import { Sheet } from "./Sheet";
import { OwnerMenu, type OwnerMenuItem } from "./OwnerMenu";
import { PokerCardSheet } from "./PokerCardSheet";
import { ChipStack } from "./primitives/Jeton";
import { TableName } from "./primitives/TableName";
import { Wallet } from "./primitives/JetonTray";

function seatStatus(seat: PokerSeatView, view: PokerTableView): string {
  if (view.phase === "HAND_COMPLETE") {
    if (seat.status === "FOLDED") return "FOLDED";
    if (view.winners.some((winner) => winner.userId === seat.userId)) return "WON";
    if (seat.status === "ALL_IN") return "ALL IN";
    return "";
  }
  if (view.phase === "SHOWDOWN") {
    if (seat.status === "FOLDED") return "FOLDED";
    if (seat.status === "ALL_IN") return "ALL IN";
    return "";
  }
  if (seat.status === "FOLDED") return "FOLDED";
  if (seat.status === "ALL_IN") return "ALL IN";
  if (seat.isActor) return seat.userId === view.viewerId ? "YOUR TURN" : "TURN";
  if (seat.streetAction === "CHECK") return "CHECKED";
  if (seat.streetAction === "CALL") return "CALLED";
  if (seat.streetAction === "BET") return "BET";
  if (seat.streetAction === "RAISE") return "RAISED";
  if (seat.streetAction === "ALL_IN") return "ALL IN";
  return "Waiting";
}

/** Seats around an ellipse; the viewer's seat sits at the bottom, next to the tray. */
function seatPosition(index: number, count: number, viewerIndex: number) {
  const start = viewerIndex >= 0 ? viewerIndex : 0;
  const angle = ((90 + ((index - start) * 360) / Math.max(count, 1)) * Math.PI) / 180;
  return { left: `${50 + 40 * Math.cos(angle)}%`, top: `${50 + 41 * Math.sin(angle)}%` };
}

function boardRow(layout: PokerActorLayout): PokerLegalActionView[] {
  const actions = [layout.primary, ...layout.secondary].filter((action): action is PokerLegalActionView => Boolean(action));
  const pick = (type: string) => actions.find((action) => action.type === type);
  const row = layout.owed
    ? [pick("FOLD"), pick("CALL"), pick("RAISE"), pick("ALL_IN")]
    : [pick("FOLD"), pick("CHECK"), pick("BET") ?? pick("RAISE"), pick("ALL_IN")];
  return row.filter((action): action is PokerLegalActionView => Boolean(action));
}

/**
 * Shared Poker felt. The Owner variant adds street controls in the rail and the table menu;
 * the Player variant is the same felt with actor actions and the wallet only.
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
  const [awardOpen, setAwardOpen] = useState(false);
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

  const layout = pokerActorLayout(visiblePokerLegalActions(view));
  const menuIds = owner ? pokerControlIds(view, "owner", "menu") : [];
  const ownerDock = owner ? pokerControls(view).filter((control) => control.layer === "owner" && control.surface === "dock") : [];
  const turn =
    view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" || view.phase === "POKER_SETUP" ? null : pokerTurnLabel(view.waitingCopy);
  const setup = view.phase === "POKER_SETUP";
  const owed = !view.potPaid && view.phase !== "HAND_COMPLETE" && view.phase !== "SHOWDOWN" && view.toCall.millis !== "0";
  const sidePots = view.pots.length > 1 && view.seats.some((seat) => seat.status === "ALL_IN") && !view.potPaid;
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

  const ownerZone = ownerDock.length > 0 ? (
    <div className="tt-owner-zone" data-owner-controls="true">
      {ownerDock.map((control) => {
        if (control.id === "assignWinners") {
          return (
            <button key={control.id} type="button" className="tt-btn gold" onClick={() => setAwardOpen(true)}>
              {control.label}
            </button>
          );
        }
        if (control.id === "dealStreet") {
          return (
            <div key={control.id} className="tt-owner-street">
              <button type="button" className={`tt-btn${control.enabled ? " gold" : ""}`} disabled={!control.enabled} onClick={() => void onCommand("advancePokerStreet")}>
                {control.label}
              </button>
              {control.hint ? <small className="tt-muted">{control.hint}</small> : null}
            </div>
          );
        }
        if (control.id === "startHand") {
          return (
            <button key={control.id} type="button" className="tt-btn gold" disabled={!control.enabled} onClick={() => void onCommand("startTexasHoldem")}>
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
    </div>
  ) : null;

  const rail = (
    <>
      {ownerZone}
      {notice || showActions ? (
        <div className="tt-controls" data-game-controls="true">
          {notice ? <div className="tt-error">{notice}</div> : null}
          {showActions ? (
            <div className="tt-actor" data-actor-controls="true" data-compose={compose ?? "closed"}>
              {boardRow(layout).map((action) => (
                <button
                  key={action.type}
                  type="button"
                  className={`tt-btn${action.type === "CALL" || action.type === "CHECK" ? " gold" : ""}`}
                  disabled={busy}
                  aria-pressed={compose === action.type}
                  onClick={() => {
                    if (action.type === "BET" || action.type === "RAISE") {
                      if (compose === action.type) {
                        setCompose(null);
                        setStaged("");
                        return;
                      }
                      openCompose(action.type);
                      return;
                    }
                    send(action.type);
                  }}
                >
                  {action.label}
                </button>
              ))}
              {compose ? (
                <div className="tt-compose" data-raise-composer="true">
                  <small data-raise-convention={pokerComposeBounds(view, compose).convention}>
                    {pokerComposeBounds(view, compose).convention} · min {pokerComposeBounds(view, compose).min}
                  </small>
                  <input
                    className="tt-input"
                    aria-label={compose === "RAISE" ? "Raise to" : "Bet amount"}
                    inputMode="numeric"
                    value={staged}
                    placeholder={pokerComposeSeed(view, compose)}
                    onChange={(event) => setStaged(event.target.value.replace(/[^\d]/g, ""))}
                  />
                  <button type="button" className="tt-btn gold" disabled={busy} onClick={confirmCompose}>
                    {compose === "RAISE" ? "CONFIRM RAISE" : "CONFIRM BET"}
                  </button>
                  <button type="button" className="tt-btn" onClick={() => setStaged("")}>
                    CLEAR
                  </button>
                  <button
                    type="button"
                    className="tt-btn"
                    onClick={() => {
                      setCompose(null);
                      setStaged("");
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <Wallet available={view.available} trayEnabled={pokerTrayEnabled(view)} dropSelector="[data-drop-pot]" onTap={stageChip} onDrop={(amount) => stageChip(amount)} />
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

  return (
    <Shell
      hideBrand
      badges={owner ? ["OWNER"] : undefined}
      onMenu={owner || showCardMenu ? () => setMenuOpen(true) : undefined}
      rail={rail}
      feltClassName="tt-poker"
      feltProps={{
        "data-table-board": owner ? "POKER_DEALER" : "POKER_PLAYER",
        "data-card-editor": cards ? "open" : "closed",
        "data-seat-count": view.seats.length,
      }}
      overlay={
        <>
          {owner ? (
            <OwnerMenu
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
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
          {owner ? (
            <Sheet open={awardOpen} onClose={() => setAwardOpen(false)} className="tt-award">
              <h3>Award pot</h3>
              {view.pots.map((pot) => (
                <div key={pot.index} className="tt-pot-assign">
                  <strong>
                    {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                  </strong>
                  <div className="tt-pot-winners">
                    {view.seats
                      .filter((seat) => pot.eligiblePlayerIds.includes(seat.userId))
                      .map((seat) => {
                        const selected = (winners[pot.index] ?? pot.winnerPlayerIds).includes(seat.userId);
                        return (
                          <button
                            key={seat.userId}
                            type="button"
                            className={`tt-btn${selected ? " gold" : ""}`}
                            aria-pressed={selected}
                            onClick={() => {
                              const current = winners[pot.index] ?? pot.winnerPlayerIds;
                              setWinners({
                                ...winners,
                                [pot.index]: selected ? current.filter((id) => id !== seat.userId) : [...current, seat.userId],
                              });
                            }}
                          >
                            {seat.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
              <button
                className="tt-btn gold"
                type="button"
                onClick={() => {
                  void onCommand("awardPokerPots", { pots: winnerPayload });
                  setAwardOpen(false);
                }}
              >
                CONFIRM AWARD
              </button>
              <button className="tt-link" type="button" onClick={() => setAwardOpen(false)}>
                Cancel
              </button>
            </Sheet>
          ) : null}
        </>
      }
    >
      <div className="tt-poker-top">
        <span className="tt-phase-display" data-phase-heading>
          {view.phaseLabel.replaceAll("_", " ")}
        </span>
        {turn ? (
          <span className={`tt-turn${turn.you ? " is-you" : ""}`} data-turn-state={turn.you ? "you" : "other"}>
            {turn.label}
          </span>
        ) : null}
        <ol className="tt-streets" aria-label="Street">
          {view.streetRail.map((stop) => (
            <li
              key={stop.id}
              className={`is-${stop.state}`}
              data-rail={stop.id}
              data-rail-state={stop.state}
              aria-current={stop.state === "current" ? "step" : undefined}
            >
              {stop.id.replaceAll("_", " ")}
            </li>
          ))}
        </ol>
      </div>
      <div className="tt-poker-table">
        <div className="tt-poker-oval" aria-hidden="true" />
        <div className="tt-poker-cloth">
          <TableName name={view.tableName} />
        </div>
        {setup ? (
          <div className="tt-pot tt-blinds">
            <span>
              SB <strong>{view.smallBlind.label}</strong>
            </span>
            <span>
              BB <strong>{view.bigBlind.label}</strong>
            </span>
          </div>
        ) : (
          <div className="tt-pot" data-drop-pot="pot" data-pot-paid={view.potPaid ? "true" : "false"}>
            <small>{view.potPaid ? "POT PAID" : "POT"}</small>
            {view.potPaid ? null : <strong className="tt-pot-amount">{view.pot.label}</strong>}
            {!view.potPaid && view.pot.millis !== "0" ? <ChipStack millis={view.pot.millis} max={4} /> : null}
            {owed ? (
              <span className="tt-to-call">
                TO CALL <strong>{view.toCall.label}</strong>
              </span>
            ) : null}
            {sidePots ? (
              <ul className="tt-pot-list">
                {view.pots.map((pot) => (
                  <li key={pot.index} data-pot-index={pot.index}>
                    {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                    {pot.winnerPlayerIds.length > 0 ? " awarded" : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {view.winners.length > 0 ? (
              <ul className="tt-pot-list" data-winners="true">
                {view.winners.map((winner) => (
                  <li key={winner.userId}>
                    {winner.name} WON {winner.amount.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {view.seats.map((seat, index) => {
          const status = seatStatus(seat, view);
          const isYou = seat.userId === view.viewerId;
          const actor = seat.isActor && view.phase !== "HAND_COMPLETE";
          const position = seatPosition(index, view.seats.length, viewerIndex);
          return (
            <section
              key={seat.userId}
              className={`tt-seat${actor ? " is-actor" : ""}${seat.isDealer ? " is-dealer" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}${seat.status === "ALL_IN" ? " is-allin" : ""}${isYou ? " is-you" : ""}`}
              style={position}
              data-player-id={seat.userId}
              data-actor={actor ? "true" : "false"}
              data-seat-status={seat.status}
              data-seat-index={index + 1}
              data-dealer={seat.isDealer ? "true" : "false"}
              data-viewer-seat={isYou ? "true" : undefined}
              data-seat-available={seat.available.label}
            >
              {!setup ? (
                <div className="tt-seat-markers">
                  {seat.isDealer ? (
                    <span className="tt-dealer-button" aria-label="Poker Dealer">
                      D
                    </span>
                  ) : null}
                  {seat.isSmallBlind ? <span className="tt-blind">SB</span> : null}
                  {seat.isBigBlind ? <span className="tt-blind">BB</span> : null}
                </div>
              ) : null}
              <strong className="tt-seat-name">{isYou ? `You · ${seat.name}` : seat.name}</strong>
              <span className="tt-seat-line">
                <small>AVAILABLE</small> {seat.available.label}
              </span>
              <span className="tt-seat-line" data-street-commit="true">
                <small>STREET</small> {setup ? "—" : seat.streetContribution.label}
              </span>
              {status ? <em className="tt-seat-status">{status}</em> : null}
            </section>
          );
        })}
      </div>
    </Shell>
  );
}
