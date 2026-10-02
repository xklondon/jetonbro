"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberView, PlayerTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { BlackjackBox } from "./BlackjackBox";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import { PlayerWallet } from "./PlayerWallet";
import { SheetOverlay } from "./SheetOverlay";
import {
  selectInsuranceCelebration,
  selectOutcomeCelebration,
  type OutcomeCelebration,
} from "@/ui/core/outcome-celebration";
import { blackjackPlayerControls, playerBoxSlots } from "@/ui/core/blackjack-phase-controls";

function seatTone(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0) * 17) % 360;
  return `hsl(${hash} 42% 42%)`;
}

export function ClassicPlayerTable({
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
  onCommand: (command: string, payload?: Record<string, string>) => void | boolean | Promise<void | boolean>;
  notice?: string | null;
  members?: MemberView[];
}) {
  const [exact, setExact] = useState("");
  const [hoverBoxId, setHoverBoxId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"menu" | "close" | "game" | "poker" | "rename" | "dealer" | "player" | "jetons" | null>(null);
  const [tableName, setTableName] = useState(view.tableName);
  const [email, setEmail] = useState("");
  const [localName, setLocalName] = useState("");
  const [amount, setAmount] = useState("");
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [memberId, setMemberId] = useState(members[0]?.userId ?? "");
  const [dealerId, setDealerId] = useState(members.find((member) => member.isBankDealer)?.userId ?? members[0]?.userId ?? "");
  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const { slots, extras } = playerBoxSlots(view.boxes);
  const controls = blackjackPlayerControls(view, selected);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [celebration, setCelebration] = useState<OutcomeCelebration | null>(null);
  const seenOutcomes = useRef(
    new Set(
      view.boxes.filter((box) => box.outcome).map((box) => `${box.settledKey ?? box.id}:${box.outcome}`),
    ),
  );
  const seenInsurance = useRef(new Set(view.boxes.filter((box) => box.insuranceResult).map((box) => box.id)));
  const playing = view.phase === "PLAYING";
  const selfId = view.boxes[0]?.playerId;
  const others = members.filter((member) => !member.isBankDealer && member.userId !== selfId);

  useEffect(() => {
    for (const box of view.boxes) {
      const key = box.outcome ? `${box.settledKey ?? box.id}:${box.outcome}` : null;
      if (key && !seenOutcomes.current.has(key)) {
        seenOutcomes.current.add(key);
        const next = selectOutcomeCelebration(key, box.outcome!, reducedMotion, "player", box.returned?.label);
        setCelebration(next);
        window.setTimeout(() => setCelebration(null), 1400);
      }
      if (box.insuranceResult && !seenInsurance.current.has(box.id)) {
        seenInsurance.current.add(box.id);
        const won = /WON/i.test(box.insuranceResult) && !/LOST/i.test(box.insuranceResult);
        const returned = box.insuranceResult?.match(/return ([0-9.]+)/)?.[1] ?? null;
        const next = selectInsuranceCelebration(`${box.id}:insurance`, won, reducedMotion, returned);
        setCelebration(next);
        window.setTimeout(() => setCelebration(null), 1400);
      }
    }
  }, [view.boxes, reducedMotion]);

  function place(amount: string, boxId: string) {
    onCommand("placeBet", { boxId, amount, mode: "ADD" });
  }

  return (
    <TableShell title={view.tableName} balance={view.available.label} badges={view.isOwner ? ["OWNER"] : undefined} onMenu={view.isOwner ? () => setSheet("menu") : undefined}>
      <OutcomeCelebrationOverlay celebration={celebration} />
      <PhaseBar label={controls.phaseLabel} kicker={controls.instruction} />
      <main
        className={`felt player-play-felt${view.phase === "BETTING" ? " betting-open" : ""}`}
        data-table-board="BLACKJACK_PLAYER"
        data-selected-box={selected?.id ?? ""}
        data-box-count={view.boxes.length}
      >
        <div className="table-surface">
          <div className="player-context">
            {others.length > 0 ? (
              <div className="player-orbit" aria-label="Other players">
                {others.map((member) => (
                  <div className="player-orbit-chip" key={member.userId}>
                    <span className="player-dot" style={{ background: seatTone(member.userId) }} />
                    <strong>{member.name}</strong>
                    <small>{member.available?.label ?? ""}</small>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="player-dealer-ring" data-dealer-row="true">
              DEALER
            </div>
          </div>
          <div className="player-box-stage" data-box-stage="true">
            {slots.map((box, index) =>
              box ? (
                <div className="stage-cell" key={box.id} data-stage-slot={index + 1}>
                  <BlackjackBox
                    box={box}
                    selected={box.id === selected?.id}
                    dropHighlight={hoverBoxId === box.id}
                    onSelect={() => onSelectBox(box.id)}
                    retractable={view.actions.retract}
                    onRetractChip={(amount) =>
                      onCommand("placeBet", { boxId: box.id, amount, mode: "RETRACT" })
                    }
                  />
                </div>
              ) : (
                <div
                  key={`slot-${index + 1}`}
                  className="box-slot"
                  data-empty-slot={index + 1}
                  data-stage-slot={index + 1}
                  data-box-slot={index + 1}
                  aria-hidden="true"
                />
              ),
            )}
            {extras.map((box) => (
              <BlackjackBox
                key={box.id}
                box={box}
                selected={box.id === selected?.id}
                dropHighlight={hoverBoxId === box.id}
                onSelect={() => onSelectBox(box.id)}
                retractable={view.actions.retract}
                onRetractChip={(amount) =>
                  onCommand("placeBet", { boxId: box.id, amount, mode: "RETRACT" })
                }
              />
            ))}
          </div>
          {controls.addBox ? (
            <div className="add-box-row">
              <button type="button" onClick={() => onCommand("addBox")}>
                ADD BOX
              </button>
            </div>
          ) : null}
        </div>
      </main>
      <footer className="dock player-dock">
        <div className="game-controls" data-game-controls="true">
          {notice ? <div className="error">{notice}</div> : null}
          {view.bankLimitReached ? <div className="error">Bank limit reached</div> : null}
          {controls.placeBet ? (
            <div className="betting-controls">
              <div className="exact">
                <input
                  type="text"
                  className="felt-input"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={exact}
                  onChange={(event) => setExact(event.target.value)}
                  aria-label="Exact bet amount"
                />
              </div>
              <div className="exact bet-pair">
                <button
                  className="panel-button"
                  type="button"
                  disabled={!controls.retract || !selected}
                  onClick={() =>
                    selected && onCommand("placeBet", { boxId: selected.id, amount: selected.bet.label, mode: "RETRACT" })
                  }
                >
                  RETRACT
                </button>
                <button
                  className="gold-button"
                  type="button"
                  disabled={!selected || !exact || selected.coverage?.bet === false}
                  onClick={() => {
                    if (!selected || !exact) return;
                    onCommand("placeBet", { boxId: selected.id, amount: exact, mode: "SET" });
                    setExact("");
                  }}
                >
                  PLACE BET
                </button>
              </div>
            </div>
          ) : null}
          {playing ? (
            <div className="play-controls" data-play-controls="true">
              <button
                type="button"
                className="primary"
                data-player-action="double"
                disabled={!controls.double}
                onClick={() => selected && onCommand("doubleBox", { boxId: selected.id })}
              >
                2×
              </button>
              <button
                type="button"
                data-player-action="split"
                disabled={!controls.split}
                onClick={() => selected && onCommand("splitBox", { boxId: selected.id })}
              >
                SPLIT
              </button>
              <button
                type="button"
                data-player-action="insurance"
                disabled={!controls.insurance}
                onClick={() => {
                  if (!selected || !controls.insurance) return;
                  onCommand("buyInsurance", {
                    boxId: selected.id,
                    amount: selected.insuranceMax.label,
                  });
                }}
              >
                INSURANCE
              </button>
            </div>
          ) : null}
        </div>
        <PlayerWallet
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
      </footer>
      {view.isOwner ? (
        <SheetOverlay open={Boolean(sheet)} onClose={() => setSheet(null)}>
          {sheet === "menu" ? (
            <>
              <h3>Table</h3>
              <button type="button" onClick={() => setSheet("player")}>
                ADD PLAYER
              </button>
              <button type="button" onClick={() => setSheet("jetons")}>
                GIVE JETONS
              </button>
              <button type="button" onClick={() => setSheet("rename")}>
                RENAME TABLE
              </button>
              <button type="button" onClick={() => setSheet("dealer")}>
                ASSIGN DEALER
              </button>
              {view.canSwitchGame ? (
                <button type="button" onClick={() => setSheet("game")}>
                  SWITCH GAME
                </button>
              ) : null}
              <button className="gold-button" type="button" onClick={() => { onCommand("saveTable"); setSheet(null); }}>
                SAVE TABLE
              </button>
              <button className="gold-button" type="button" onClick={() => setSheet("close")}>
                CLOSE TABLE & SAVE BALANCES
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "game" ? (
            <>
              <h3>Switch game</h3>
              <button className="gold-button" type="button" onClick={() => { onCommand("switchGame", { game: "BLACKJACK" }); setSheet(null); }}>
                Blackjack
              </button>
              <button className="gold-button" type="button" onClick={() => setSheet("poker")}>
                Texas Hold’em
              </button>
              <button type="button" disabled>
                Zilch — Coming later
              </button>
              <button className="text-link" type="button" onClick={() => setSheet(null)}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "poker" ? (
            <>
              <h3>Texas Hold’em</h3>
              <label>
                Small blind
                <input value={smallBlind} onChange={(event) => setSmallBlind(event.target.value)} aria-label="Small blind" />
              </label>
              <label>
                Big blind
                <input value={bigBlind} onChange={(event) => setBigBlind(event.target.value)} aria-label="Big blind" />
              </label>
              <button
                className="gold-button"
                type="button"
                onClick={() => {
                  onCommand("switchGame", {
                    game: "POKER",
                    smallBlind,
                    bigBlind,
                    seatOrder: members.map((member) => member.userId).join(","),
                  });
                  setSheet(null);
                }}
              >
                SWITCH TO TEXAS HOLD’EM
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("game")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "rename" ? (
            <>
              <h3>Rename table</h3>
              <label>
                Table name
                <input aria-label="Table name" value={tableName} onChange={(event) => setTableName(event.target.value)} />
              </label>
              <button className="gold-button" type="button" onClick={() => { onCommand("updateSettings", { name: tableName }); setSheet(null); }}>
                Save name
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "dealer" ? (
            <>
              <h3>Assign Dealer</h3>
              <label>
                Dealer
                <select aria-label="Dealer" value={dealerId} onChange={(event) => setDealerId(event.target.value)}>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="gold-button" type="button" onClick={() => { onCommand("assignBank", { userId: dealerId }); setSheet(null); }}>
                Confirm dealer
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "close" ? (
            <>
              <h3>Close {view.tableName}</h3>
              <p>{view.closePreview?.confirmation ?? `Save remaining jetons and close ${view.tableName}?`}</p>
              <button className="gold-button" type="button" onClick={() => { onCommand("closeTable"); setSheet(null); }}>
                Confirm close
              </button>
              <button className="text-link" type="button" onClick={() => setSheet("menu")}>
                Cancel
              </button>
            </>
          ) : null}
          {sheet === "jetons" || sheet === "player" ? (
            <>
              <h3>{sheet === "jetons" ? "Give jetons" : "Add player"}</h3>
              {sheet === "jetons" ? (
                <>
                  <select value={memberId} onChange={(event) => setMemberId(event.target.value)} aria-label="Player">
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
                  <input placeholder="Player name" aria-label="Player name" value={localName} onChange={(event) => setLocalName(event.target.value)} />
                  <input placeholder="Starting jetons" aria-label="Starting jetons" value={amount} onChange={(event) => setAmount(event.target.value)} />
                  <input placeholder="Email optional" aria-label="Player email" value={email} onChange={(event) => setEmail(event.target.value)} />
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
                    else if (email.trim()) onCommand("addPlayer", { email, name: localName });
                    else onCommand("addPlayer", { name: localName, startingJetons: amount });
                    setSheet(null);
                  }}
                >
                  Confirm
                </button>
              </div>
            </>
          ) : null}
        </SheetOverlay>
      ) : null}
    </TableShell>
  );
}
