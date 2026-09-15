"use client";

import { useMemo, useState } from "react";
import type { PlayerTableView } from "@/application/queries/views";
import { PhoneShell } from "./PhoneShell";
import { FeltBox } from "./FeltBox";

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
  const selected = view.boxes.find((box) => box.id === selectedBoxId) ?? view.boxes[0];
  const boxClass = useMemo(() => {
    if (view.boxes.length >= 4) return "player-boxes scroll";
    if (view.boxes.length === 3) return "player-boxes three";
    return "player-boxes";
  }, [view.boxes.length]);

  return (
    <PhoneShell rightLabel={`♠ ${view.boxes.length}`}>
      <div className="phase-head">
        <strong>{view.title}</strong>
        <span>{view.copy}</span>
      </div>
      <main className="felt">
        <div className={boxClass}>
          {view.boxes.map((box) => (
            <FeltBox
              key={box.id}
              box={box}
              selected={box.id === selected?.id}
              onSelect={() => onSelectBox(box.id)}
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
          {["5", "10", "25", "50"].map((denom) => (
            <button
              key={denom}
              type="button"
              disabled={!view.actions.bet || !selected}
              onClick={() =>
                selected && onCommand("placeBet", { boxId: selected.id, amount: denom, mode: "ADD" })
              }
              aria-label={`Add ${denom} jetons`}
            >
              <span className={`chip c${denom}`}>{denom}</span>
            </button>
          ))}
        </div>
      </footer>
    </PhoneShell>
  );
}

