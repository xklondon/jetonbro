"use client";

import { useMemo, useState } from "react";
import type { MemberView, PokerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { DealCountdown } from "./DealCountdown";
import { PokerFelt } from "./PokerFelt";
import { PokerGameControls } from "./PokerGameControls";

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
      <div className="phase-head">
        <strong>{view.tableName}</strong>
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
      </div>
      <PokerFelt
        view={view}
        onReorder={view.canReorderSeats ? (seatOrder) => onCommand("configurePoker", { seatOrder }) : undefined}
      />
      <PokerGameControls view={view} onCommand={onCommand} notice={notice} onOwnerSheet={setSheet} />
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
