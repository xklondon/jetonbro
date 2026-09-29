"use client";

import { useMemo, useState } from "react";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { communityCardLimit } from "@/domain/poker/cards";
import { pokerControlIds, pokerControls, pokerTurnLabel } from "@/application/queries/poker-controls";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { PhaseActionDock } from "./PhaseActionDock";
import { PokerFelt } from "./PokerFelt";
import { PokerGameControls } from "./PokerGameControls";
import { PokerStreetRail } from "./PokerStreetRail";
import { SeatOrderList } from "./SeatOrderList";
import { PokerCardSheet } from "./PokerCardPicker";

type OwnerSheet = "menu" | "seats" | "player" | "jetons" | "game" | null;

export function ClassicPokerDealer({
  view,
  members,
  onCommand,
  notice,
}: {
  view: PokerTableView;
  members: MemberView[];
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [sheet, setSheet] = useState<OwnerSheet>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const [cards, setCards] = useState<"hole" | "board" | null>(null);
  const menuIds = pokerControlIds(view, "owner", "menu");
  const ownerDock = pokerControls(view).filter((control) => control.layer === "owner" && control.surface === "dock");
  const turn =
    view.phase === "HAND_COMPLETE" || view.phase === "SHOWDOWN" || view.phase === "POKER_SETUP"
      ? null
      : pokerTurnLabel(view.waitingCopy);
  const ownHole = view.seats.find((seat) => seat.userId === view.viewerId)?.holeCards ?? [];
  const winnerPayload = useMemo(
    () =>
      JSON.stringify(
        view.pots.map((pot) => ({
          index: pot.index,
          winnerIds: winners[pot.index] ?? pot.winnerPlayerIds,
        })),
      ),
    [view.pots, winners],
  );

  return (
    <TableShell badges={["OWNER"]} onMenu={() => setSheet("menu")}>
      <PhaseBar prefix="POKER" label={view.phaseLabel}>
        {turn ? (
          <div className={`poker-turn-banner${turn.you ? " is-you" : ""}`} data-turn-state={turn.you ? "you" : "other"}>
            {turn.label}
          </div>
        ) : null}
        <PokerStreetRail stops={view.streetRail} />
        {ownerDock.length > 0 ? (
          <PhaseActionDock>
            <div className="owner-controls" data-owner-controls="true">
              {ownerDock.map((control) => {
                if (control.id === "assignWinners") {
                  return (
                    <div key={control.id} className="poker-award">
                      {view.pots.map((pot) => (
                        <div key={pot.index} className="poker-pot-assign">
                          <strong>
                            {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                          </strong>
                          {view.seats
                            .filter((seat) => pot.eligiblePlayerIds.includes(seat.userId))
                            .map((seat) => {
                              const selected = (winners[pot.index] ?? pot.winnerPlayerIds).includes(seat.userId);
                              return (
                                <button
                                  key={seat.userId}
                                  type="button"
                                  className={selected ? "active" : ""}
                                  onClick={() => {
                                    const current = winners[pot.index] ?? pot.winnerPlayerIds;
                                    const next = selected
                                      ? current.filter((id) => id !== seat.userId)
                                      : [...current, seat.userId];
                                    setWinners({ ...winners, [pot.index]: next });
                                  }}
                                >
                                  {seat.name}
                                </button>
                              );
                            })}
                        </div>
                      ))}
                      <button
                        className="gold-button"
                        type="button"
                        onClick={() => onCommand("awardPokerPots", { pots: winnerPayload })}
                      >
                        {control.label}
                      </button>
                    </div>
                  );
                }
                if (control.id === "dealStreet") {
                  return (
                    <div key={control.id} className="owner-street">
                      <button
                        type="button"
                        className={control.enabled ? "gold-button" : undefined}
                        disabled={!control.enabled}
                        onClick={() => onCommand("advancePokerStreet")}
                      >
                        {control.label}
                      </button>
                      {control.hint ? <small className="phase-hint">{control.hint}</small> : null}
                    </div>
                  );
                }
                if (control.id === "startHand") {
                  return (
                    <button
                      key={control.id}
                      type="button"
                      className="gold-button"
                      disabled={!control.enabled}
                      onClick={() => onCommand("startTexasHoldem")}
                    >
                      {control.label}
                    </button>
                  );
                }
                if (control.id === "nextHand") {
                  return (
                    <button
                      key={control.id}
                      type="button"
                      className="gold-button"
                      onClick={() => onCommand("startNextPokerHand")}
                    >
                      {control.label}
                    </button>
                  );
                }
                return null;
              })}
            </div>
          </PhaseActionDock>
        ) : null}
      </PhaseBar>
      <PokerFelt view={view} />
      <PokerGameControls view={view} onCommand={onCommand} notice={notice} />
      {cards === "board" ? (
        <PokerCardSheet
          title="Board cards"
          cards={view.communityCards}
          max={communityCardLimit(view.phase)}
          onSave={(next) => onCommand("setPokerCommunityCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
      {cards === "hole" ? (
        <PokerCardSheet
          title="Hole cards"
          cards={ownHole}
          max={2}
          onSave={(next) => onCommand("setPokerHoleCards", { cards: JSON.stringify(next) })}
          onClose={() => setCards(null)}
        />
      ) : null}
      <div className={`sheet${sheet ? " open" : ""}`}>
        <div className="sheet-panel">
          {sheet === "menu" ? (
            <>
              <h3>Table</h3>
              {menuIds.includes("reorderSeats") ? (
                <button className="gold-button" type="button" onClick={() => setSheet("seats")}>
                  SEAT ORDER
                </button>
              ) : null}
              {menuIds.includes("addPlayer") ? (
                <button type="button" onClick={() => setSheet("player")}>
                  + PLAYER
                </button>
              ) : null}
              {menuIds.includes("giveJetons") ? (
                <button type="button" onClick={() => setSheet("jetons")}>
                  GIVE JETONS
                </button>
              ) : null}
              {menuIds.includes("switchGame") ? (
                <button type="button" onClick={() => setSheet("game")}>
                  SWITCH GAME
                </button>
              ) : null}
              {menuIds.includes("scheduleNextHand") ? (
                <button type="button" onClick={() => { onCommand("scheduleNextPokerHand"); setSheet(null); }}>
                  NEXT HAND IN 7 SECONDS
                </button>
              ) : null}
              {view.canEditHole || view.canEditCommunity ? (
                <>
                  <div className="field-label">OPTIONAL TOOLS</div>
                  {view.canEditHole ? (
                    <button type="button" onClick={() => { setSheet(null); setCards("hole"); }}>
                      + HOLE CARDS
                    </button>
                  ) : null}
                  {view.canEditCommunity ? (
                    <button type="button" onClick={() => { setSheet(null); setCards("board"); }}>
                      + BOARD CARDS
                    </button>
                  ) : null}
                </>
              ) : null}
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "seats" ? (
            <>
              <h3>Seat order</h3>
              <p className="muted">Dealer button follows this order after START HAND. Order locks when the first hand begins.</p>
              <SeatOrderList
                seats={view.seats}
                onReorder={(seatOrder) => onCommand("configurePoker", { seatOrder })}
              />
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Back
              </button>
            </>
          ) : null}
          {sheet === "game" ? (
            <>
              <h3>Switch game</h3>
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("switchGame", { game: "BLACKJACK" });
                  setSheet(null);
                }}
              >
                Blackjack
              </button>
              <button type="button" disabled>
                Zilch — Coming later
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "jetons" || sheet === "player" ? (
            <>
              <h3>{sheet === "jetons" ? "Give jetons" : "Add player"}</h3>
              {sheet === "jetons" ? (
                <>
                  <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                    {members.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <input placeholder="Jeton amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </>
              ) : (
                <>
                  <input placeholder="Player name" value={name} onChange={(event) => setName(event.target.value)} />
                  <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </>
              )}
              <div className="sheet-actions">
                <button type="button" onClick={() => setSheet(null)}>
                  Cancel
                </button>
                <button
                  className="gold-button"
                  type="button"
                  onClick={() => {
                    if (sheet === "jetons") onCommand("giveJetons", { userId: memberId, amount });
                    else onCommand("addPlayer", { email, name });
                    setSheet(null);
                  }}
                >
                  Confirm
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </TableShell>
  );
}
