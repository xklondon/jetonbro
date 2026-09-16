"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { FeltBox } from "./FeltBox";
import { DealCountdown } from "./DealCountdown";
import { OutcomeCelebrationOverlay } from "./OutcomeCelebration";
import {
  selectInsuranceCelebration,
  selectOutcomeCelebration,
  type OutcomeCelebration,
} from "@/ui/core/outcome-celebration";

const DENOMS = ["5", "10", "25", "50"] as const;

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
  const [drag, setDrag] = useState<{ denom: string; x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const draggingDenom = useRef<string | null>(null);
  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const boxClass = useMemo(() => {
    if (view.boxes.length >= 4) return "player-boxes scroll";
    if (view.boxes.length === 3) return "player-boxes three";
    if (view.boxes.length === 2) return "player-boxes two";
    return "player-boxes one";
  }, [view.boxes.length]);
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [celebration, setCelebration] = useState<OutcomeCelebration | null>(null);
  const seenOutcomes = useRef(
    new Set(
      view.boxes.filter((box) => box.outcome).map((box) => `${box.settledKey ?? box.id}:${box.outcome}`),
    ),
  );
  const seenInsurance = useRef(new Set(view.boxes.filter((box) => box.insuranceResult).map((box) => box.id)));

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
        const won = /return/i.test(box.insuranceResult) && !/lost/i.test(box.insuranceResult);
        const returned = box.insuranceResult?.match(/return ([0-9.]+)/)?.[1] ?? null;
        const next = selectInsuranceCelebration(`${box.id}:insurance`, won, reducedMotion, returned);
        setCelebration(next);
        window.setTimeout(() => setCelebration(null), 1400);
      }
    }
  }, [view.boxes, reducedMotion]);

  function boxAtPoint(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    return el?.closest("[data-drop-box]")?.getAttribute("data-drop-box") ?? null;
  }

  function place(amount: string, boxId: string) {
    onCommand("placeBet", { boxId, amount, mode: "ADD" });
  }

  return (
    <PhoneShell rightLabel={`♠ ${view.boxes.length}`}>
      <OutcomeCelebrationOverlay celebration={celebration} />
      <div className="phase-head">
        <strong>{view.title}</strong>
        <span>{view.copy}</span>
        <DealCountdown deadline={view.bettingCloseDeadlineAt} />
        <DealCountdown deadline={view.nextRoundDeadlineAt} label="Next round in" />
      </div>
      <main className={`felt${view.phase === "BETTING" ? " betting-open" : ""}${view.bettingCloseDeadlineAt ? " betting-closing" : ""}`}>
        <div className={boxClass}>
          {view.boxes.map((box) => (
            <FeltBox
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
      </main>
      <footer className="dock player-dock">
        {notice ? <div className="error">{notice}</div> : null}
        {view.actions.bet ? (
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
              className="gold-button"
              type="button"
              onClick={() => {
                if (!selected || !exact) return;
                onCommand("placeBet", { boxId: selected.id, amount: exact, mode: "SET" });
                setExact("");
              }}
            >
              Bet
            </button>
            <button
              className="gold-button"
              type="button"
              onClick={() => view.actions.addBox && onCommand("addBox")}
            >
              + Box
            </button>
            <button
              className="gold-button"
              type="button"
              disabled={!selected || selected.bet.label === "0"}
              onClick={() =>
                selected && onCommand("placeBet", { boxId: selected.id, amount: selected.bet.label, mode: "RETRACT" })
              }
            >
              Retract
            </button>
          </div>
        ) : null}
        {view.actions.double || view.actions.split || view.actions.insurance ? (
          <div>
            {view.actions.insurance ? (
              <div className="exact">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Insurance amount"
                  value={insuranceAmount}
                  onChange={(event) => setInsuranceAmount(event.target.value)}
                  aria-label="Insurance amount"
                />
              </div>
            ) : null}
            <div className="play-controls">
              <button
                type="button"
                disabled={!view.actions.insurance || !selected}
                onClick={() =>
                  selected &&
                  onCommand("buyInsurance", {
                    boxId: selected.id,
                    amount: insuranceAmount || selected.insuranceMax.label,
                  })
                }
              >
                Insurance
              </button>
              <button
                type="button"
                className="primary"
                disabled={!view.actions.double || !selected}
                onClick={() => selected && onCommand("doubleBox", { boxId: selected.id })}
              >
                Double
              </button>
              <button
                type="button"
                disabled={!view.actions.split || !selected}
                onClick={() => selected && onCommand("splitBox", { boxId: selected.id })}
              >
                Split
              </button>
            </div>
          </div>
        ) : null}
        {view.phase === "PAYOUT" || view.phase === "ROUND_COMPLETE" ? (
          <div className="payout-wait">{view.title}</div>
        ) : null}
        <div className="dock-top">
          <div>
            <small>YOUR JETONS</small>
            <strong>{view.available.label}</strong>
          </div>
          <div style={{ textAlign: "right" }}>
            <small>AVAILABLE VALUE</small>
            <strong>{view.available.label}</strong>
          </div>
        </div>
        <div className="jetons">
          {DENOMS.map((denom) => (
            <button
              key={denom}
              type="button"
              disabled={!view.actions.bet || !selected}
              aria-label={`Add ${denom} jetons`}
              style={drag ? { touchAction: "none" } : undefined}
              onPointerDown={(event) => {
                if (!view.actions.bet) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                skipClick.current = false;
                origin.current = { x: event.clientX, y: event.clientY };
                draggingDenom.current = denom;
                setDrag({ denom, x: event.clientX, y: event.clientY });
              }}
              onPointerMove={(event) => {
                if (draggingDenom.current !== denom || !origin.current) return;
                const dist = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y);
                if (dist > 8) skipClick.current = true;
                setDrag({ denom, x: event.clientX, y: event.clientY });
                setHoverBoxId(boxAtPoint(event.clientX, event.clientY));
              }}
              onPointerUp={(event) => {
                const target = boxAtPoint(event.clientX, event.clientY);
                const dragged = skipClick.current;
                draggingDenom.current = null;
                origin.current = null;
                setDrag(null);
                setHoverBoxId(null);
                if (dragged && target) {
                  place(denom, target);
                }
              }}
              onPointerCancel={() => {
                draggingDenom.current = null;
                origin.current = null;
                setDrag(null);
                setHoverBoxId(null);
              }}
              onClick={() => {
                if (skipClick.current) {
                  skipClick.current = false;
                  return;
                }
                if (selected) place(denom, selected.id);
              }}
            >
              <span className={`chip c${denom}${drag?.denom === denom && !reducedMotion ? " chip-lift" : ""}`}>
                {denom}
              </span>
            </button>
          ))}
        </div>
      </footer>
      {drag ? (
        <div
          className={`drag-ghost chip c${drag.denom}${reducedMotion ? "" : " settling"}`}
          style={{ left: drag.x, top: drag.y }}
          aria-hidden="true"
        >
          {drag.denom}
        </div>
      ) : null}
    </PhoneShell>
  );
}
