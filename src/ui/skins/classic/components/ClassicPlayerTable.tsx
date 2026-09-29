"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerTableView } from "@/application/queries/views";
import { TableShell } from "./TableShell";
import { PhaseBar } from "./PhaseBar";
import { TableIdentity } from "./TableIdentity";
import { BlackjackBox } from "./BlackjackBox";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import { PlayerWallet } from "./PlayerWallet";
import {
  selectInsuranceCelebration,
  selectOutcomeCelebration,
  type OutcomeCelebration,
} from "@/ui/core/outcome-celebration";

function phaseLabel(view: PlayerTableView) {
  if (view.insuranceWindowOpen) return "INSURANCE";
  if (view.phase === "ROUND_COMPLETE") return "PAYOUT";
  return view.phase.replaceAll("_", " ");
}

export function ClassicPlayerTable({
  view,
  selectedBoxId,
  onSelectBox,
  onCommand,
  notice,
}: {
  view: PlayerTableView;
  selectedBoxId: string | null;
  onSelectBox: (id: string) => void;
  onCommand: (command: string, payload?: Record<string, string>) => void;
  notice?: string | null;
}) {
  const [exact, setExact] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [hoverBoxId, setHoverBoxId] = useState<string | null>(null);
  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const slots: Array<(typeof view.boxes)[number] | null> = [null, null, null];
  const extras: typeof view.boxes = [];
  for (const box of view.boxes) {
    const index = box.boxNumber >= 1 && box.boxNumber <= 3 ? box.boxNumber - 1 : -1;
    if (index >= 0 && !slots[index]) slots[index] = box;
    else extras.push(box);
  }
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
  const resolved = view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE";

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
    <TableShell>
      <OutcomeCelebrationOverlay celebration={celebration} />
      <PhaseBar label={phaseLabel(view)} />
      <main
        className={`felt player-play-felt${view.phase === "BETTING" ? " betting-open" : ""}`}
        data-selected-box={selected?.id ?? ""}
        data-box-count={view.boxes.length}
      >
        <div className="table-surface">
          <TableIdentity name={view.tableName} />
          <div className="player-dealer-ring" data-dealer-row="true">
            DEALER
          </div>
          <div className="player-box-stage" data-box-stage="true">
            {slots.map((box, index) =>
              box ? (
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
              ) : (
                <div
                  key={`slot-${index + 1}`}
                  className="box-slot"
                  data-empty-slot={index + 1}
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
        </div>
      </main>
      <footer className="dock player-dock">
        <div className="game-controls" data-game-controls="true">
          {notice ? <div className="error">{notice}</div> : null}
          {view.bankLimitReached ? <div className="error">Bank limit reached</div> : null}
          {view.actions.bet ? (
            <div className="betting-controls">
              <button
                className="start-box"
                type="button"
                disabled={!view.actions.addBox}
                onClick={() => view.actions.addBox && onCommand("addBox")}
              >
                START ADDITIONAL BOX
              </button>
              <div className="exact">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={exact}
                  onChange={(event) => setExact(event.target.value)}
                  aria-label="Exact bet amount"
                />
                <button
                  type="button"
                  disabled={!selected || selected.bet.label === "0"}
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
          {playing && view.insuranceWindowOpen ? (
            <div className="insurance-dock" data-insurance-controls="true">
              <strong>INSURANCE</strong>
              <span className="muted">Up to half the box stake</span>
              {selected?.insurance ? (
                <span className="insurance-placed">
                  INSURANCE {selected.insurance.label}
                </span>
              ) : null}
              <div className="exact">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Amount"
                  value={insuranceAmount}
                  onChange={(event) => setInsuranceAmount(event.target.value)}
                  aria-label="Insurance amount"
                />
                <button
                  className="gold-button"
                  type="button"
                  disabled={!view.actions.insurance || !selected || selected.coverage?.insurance === false}
                  onClick={() =>
                    selected &&
                    onCommand("buyInsurance", {
                      boxId: selected.id,
                      amount: insuranceAmount || selected.insuranceMax.label,
                    })
                  }
                >
                  PLACE INSURANCE
                </button>
              </div>
            </div>
          ) : null}
          {playing ? (
            <div className="play-controls">
              <button
                type="button"
                className="primary"
                disabled={!view.actions.double || !selected || selected.coverage?.double === false}
                onClick={() => selected && onCommand("doubleBox", { boxId: selected.id })}
              >
                DOUBLE
              </button>
              <button
                type="button"
                disabled={!view.actions.split || !selected || selected.coverage?.split === false}
                onClick={() => selected && onCommand("splitBox", { boxId: selected.id })}
              >
                SPLIT
              </button>
              <button
                type="button"
                disabled={!view.actions.insurance || !selected || selected.coverage?.insurance === false}
                onClick={() =>
                  selected &&
                  onCommand("buyInsurance", {
                    boxId: selected.id,
                    amount: insuranceAmount || selected.insuranceMax.label,
                  })
                }
              >
                INSURANCE
              </button>
            </div>
          ) : null}
          {resolved ? <div className="payout-wait">ROUND COMPLETE</div> : null}
        </div>
        <PlayerWallet
          available={view.available}
          trayEnabled={Boolean(view.actions.bet && selected && selected.coverage?.bet !== false)}
          dropSelector="[data-drop-box]"
          onTap={(amount) => {
            if (selected) place(amount, selected.id);
          }}
          onDrop={(amount, targetId) => {
            setHoverBoxId(null);
            place(amount, targetId);
          }}
          onHover={setHoverBoxId}
        />
      </footer>
    </TableShell>
  );
}
