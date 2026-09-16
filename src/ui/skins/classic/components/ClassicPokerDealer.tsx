"use client";

import { useMemo, useState } from "react";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { DealCountdown } from "./DealCountdown";
import { PokerPlayerDock } from "./PokerPlayerDock";

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
  const [sheet, setSheet] = useState<"player" | "jetons" | "game" | "winners" | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const [winners, setWinners] = useState<Record<number, string[]>>({});
  const setup = view.phase === "POKER_SETUP";

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
    <PhoneShell rightLabel={`♠ ${view.seats.length}`}>
      <div>
        <div className="phase-head">
          <strong>{view.tableName}</strong>
          <span>{view.headline}</span>
        </div>
        <div className="bank-phase-control">
          <div className="current">
            CURRENT PHASE: <strong>{view.phaseLabel}</strong>
          </div>
          <DealCountdown deadline={view.nextHandDeadlineAt} label="Next hand in" />
          {setup ? (
            <button type="button" className="gold-button" onClick={() => onCommand("startTexasHoldem")}>
              START TEXAS HOLD’EM
            </button>
          ) : null}
          {view.nextStreetLabel ? (
            <button
              type="button"
              className="gold-button"
              disabled={!view.canDealStreet}
              onClick={() => onCommand("advancePokerStreet")}
            >
              {view.nextStreetLabel}
            </button>
          ) : null}
          {view.canAward ? (
            <button type="button" className="gold-button" onClick={() => setSheet("winners")}>
              ASSIGN WINNERS
            </button>
          ) : null}
          {view.canNextHand ? (
            <div className="deal-actions">
              <button type="button" onClick={() => onCommand("startNextPokerHand")}>
                NEXT HAND NOW
              </button>
              <button type="button" onClick={() => onCommand("scheduleNextPokerHand")}>
                NEXT HAND IN 7 SECONDS
              </button>
            </div>
          ) : null}
        </div>
        {view.waitingCopy ? (
          <div
            className={`poker-turn-banner${view.waitingCopy === "YOUR TURN" ? " is-you" : ""}`}
            data-turn-state={view.waitingCopy === "YOUR TURN" ? "you" : "waiting"}
          >
            {view.waitingCopy}
          </div>
        ) : null}
      </div>
      <main className="felt poker-felt">
        <div className="poker-pot" data-drop-pot="pot">
          <small>POT</small>
          <strong>{view.pot.label}</strong>
          <div className="muted">
            SB {view.smallBlind.label} · BB {view.bigBlind.label}
          </div>
          {view.pots.length > 0 ? (
            <ul className="poker-pot-list">
              {view.pots.map((pot) => (
                <li key={pot.index} data-pot-index={pot.index}>
                  {pot.index === 0 ? "Main pot" : `Side pot ${pot.index}`} · {pot.amount.label}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {view.canReorderSeats ? (
          <ol className="seat-order" aria-label="Dealer rotation order">
            {view.seats.map((seat, index) => (
              <li key={seat.userId} className="seat-order-row">
                <span>
                  {index + 1}. {seat.name}
                </span>
                <span className="seat-order-controls">
                  <button
                    type="button"
                    aria-label={`Move ${seat.name} up`}
                    disabled={index === 0}
                    onClick={() => {
                      const ids = view.seats.map((item) => item.userId);
                      const next = [...ids];
                      const [item] = next.splice(index, 1);
                      next.splice(index - 1, 0, item!);
                      onCommand("configurePoker", { seatOrder: next.join(",") });
                    }}
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${seat.name} down`}
                    disabled={index === view.seats.length - 1}
                    onClick={() => {
                      const ids = view.seats.map((item) => item.userId);
                      const next = [...ids];
                      const [item] = next.splice(index, 1);
                      next.splice(index + 1, 0, item!);
                      onCommand("configurePoker", { seatOrder: next.join(",") });
                    }}
                  >
                    Move down
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="dealer-list">
          {view.seats.map((seat, index) => (
            <section
              key={seat.userId}
              className={`dealer-player poker-seat${seat.isActor ? " is-actor" : ""}${seat.status === "FOLDED" ? " is-folded" : ""}`}
              data-player-id={seat.userId}
              data-actor={seat.isActor ? "true" : "false"}
              data-seat-index={index + 1}
            >
              <header className="dealer-player-head">
                <div>
                  <strong>{seat.name}</strong>
                  <div className="muted">
                    {seat.isDealer ? "D · " : ""}
                    {seat.isSmallBlind ? "SB · " : ""}
                    {seat.isBigBlind ? "BB · " : ""}
                    {seat.status === "ALL_IN" ? "ALL IN" : seat.status === "FOLDED" ? "Folded" : seat.status}
                  </div>
                </div>
                <div className="dealer-player-balances">
                  <span>Available {seat.available.label}</span>
                  <span>In {seat.contribution.label}</span>
                </div>
              </header>
            </section>
          ))}
        </div>
      </main>
      <footer className="dock player-dock">
        <PokerPlayerDock view={view} onCommand={onCommand} notice={notice} />
        <div className="dealer-tools betting-utilities">
          {view.canSwitchGame ? (
            <button type="button" onClick={() => setSheet("game")}>
              SWITCH GAME
            </button>
          ) : null}
          {view.canAddPlayer ? (
            <button type="button" onClick={() => setSheet("player")}>
              + PLAYER
            </button>
          ) : null}
          {view.canGiveJetons ? (
            <button type="button" onClick={() => setSheet("jetons")}>
              GIVE JETONS
            </button>
          ) : null}
        </div>
      </footer>
      <div className={`sheet${sheet ? " open" : ""}`}>
        <div className="sheet-panel">
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
