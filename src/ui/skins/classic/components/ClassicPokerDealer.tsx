"use client";

import { useMemo, useState } from "react";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { pokerControlIds } from "@/application/queries/poker-controls";
import { PhoneShell } from "./PhoneShell";
import { DealCountdown } from "./DealCountdown";
import { PokerFelt } from "./PokerFelt";
import { PokerGameControls } from "./PokerGameControls";
import { PokerStreetRail } from "./PokerStreetRail";
import { SeatOrderList } from "./SeatOrderList";

type OwnerSheet = "menu" | "seats" | "player" | "jetons" | "game" | "winners" | null;

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
  const menuIds = pokerControlIds(view, "owner", "menu");

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
    <PhoneShell rightLabel={`♠ ${view.seats.length}`} onMenu={() => setSheet("menu")}>
      <div className="phase-head">
        <strong data-table-name={view.tableName}>{view.tableName}</strong>
        <span>
          Texas Hold’em · <strong>{view.phaseLabel}</strong>
        </span>
        {view.waitingCopy ? (
          <div
            className={`poker-turn-banner${view.waitingCopy === "YOUR TURN" ? " is-you" : ""}`}
            data-turn-state={view.waitingCopy === "YOUR TURN" ? "you" : "waiting"}
          >
            {view.waitingCopy}
          </div>
        ) : null}
        <DealCountdown deadline={view.nextHandDeadlineAt} label="Next hand in" />
        <PokerStreetRail stops={view.streetRail} />
      </div>
      <PokerFelt view={view} onCommand={onCommand} />
      <PokerGameControls view={view} onCommand={onCommand} notice={notice} onOwnerSheet={setSheet} />
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
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "seats" ? (
            <>
              <h3>Seat order</h3>
              <p className="muted">Dealer button follows this order after DEAL CARDS. Order locks when the first hand begins.</p>
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
              <button className="gold-button" type="button" onClick={() => { onCommand("switchGame", { game: "BLACKJACK" }); setSheet(null); }}>
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
          {sheet === "winners" ? (
            <>
              <h3>Award pots</h3>
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
                            const next = selected ? current.filter((id) => id !== seat.userId) : [...current, seat.userId];
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
                onClick={() => {
                  onCommand("awardPokerPots", { pots: winnerPayload });
                  setSheet(null);
                }}
              >
                AWARD POTS
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
    </PhoneShell>
  );
}
