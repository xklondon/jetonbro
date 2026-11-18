"use client";

import type { BoxView } from "@/application/queries/views";
import { chipCompositionFromMillis } from "@/domain/jetons/chips";
import { CasinoJeton } from "./primitives/CasinoJeton";

function toneDenomForTotal(millis: string, label: string): string {
  try {
    const value = BigInt(millis || "0");
    if (value <= 0n) return "0";
    const chips = chipCompositionFromMillis(value);
    return chips[0]?.label ?? label;
  } catch {
    return label;
  }
}

function wagerForBox(box: BoxView, pendingLabel?: string | null, nextRoundLabel?: string | null): {
  label: string;
  millis: string;
} | null {
  if (pendingLabel && pendingLabel !== "0") {
    const n = Number(pendingLabel);
    if (Number.isFinite(n) && n > 0) {
      return { label: pendingLabel, millis: String(Math.round(n * 1000)) };
    }
  }
  if (nextRoundLabel && nextRoundLabel !== "0") {
    const n = Number(nextRoundLabel);
    if (Number.isFinite(n) && n > 0) {
      return { label: nextRoundLabel, millis: String(Math.round(n * 1000)) };
    }
  }
  if (box.bet.label !== "0") {
    return { label: box.bet.label, millis: box.bet.millis };
  }
  return null;
}

export function PremiumBlackjackJetonView({
  boxes,
  selectedBoxId,
  pendingByBoxId,
  nextRoundByBoxId,
  onSelectBox,
  phaseLabel,
}: {
  boxes: BoxView[];
  selectedBoxId: string | null;
  pendingByBoxId?: Record<string, string | null | undefined>;
  nextRoundByBoxId?: Record<string, string | null | undefined>;
  onSelectBox: (id: string) => void;
  phaseLabel?: string;
}) {
  const count = boxes.length;
  const layout = count <= 1 ? "is-one" : count === 2 ? "is-two" : "is-scroll";

  return (
    <section
      className={`pm-bj-jeton-view ${layout}`}
      data-bj-jeton-view="true"
      data-box-count={String(count)}
      aria-label="Jeton view"
    >
      <header className="pm-bj-jeton-view-banner">
        <span className="pm-bj-jeton-view-rule" aria-hidden="true" />
        <div className="pm-bj-jeton-view-copy">
          <strong>BLACKJACK · JETON VIEW</strong>
          <small>{phaseLabel ? phaseLabel : "Your boxes only."}</small>
        </div>
        <span className="pm-bj-jeton-view-rule" aria-hidden="true" />
      </header>

      {count === 0 ? (
        <p className="pm-bj-empty">Waiting for a box</p>
      ) : (
        <div className="pm-bj-jeton-track" data-bj-jeton-track="true">
          {boxes.map((box) => {
            const selected = box.id === selectedBoxId;
            const wager = wagerForBox(
              box,
              pendingByBoxId?.[box.id],
              nextRoundByBoxId?.[box.id],
            );
            const ranks = box.hand?.ranks ?? [];
            return (
              <button
                key={box.id}
                type="button"
                className={`pm-bj-jeton-box${selected ? " is-selected" : ""}`}
                data-box-id={box.id}
                data-box-number={box.boxNumber}
                data-bj-jeton-box="true"
                aria-pressed={selected}
                aria-label={`Box ${box.boxNumber}${wager ? ` · ${wager.label}` : ""}`}
                onClick={() => onSelectBox(box.id)}
              >
                <span className="pm-bj-jeton-box-label">BOX {box.boxNumber}</span>
                {wager ? (
                  <span className="pm-bj-jeton-hero-wrap" data-bj-jeton-hero="true">
                    <CasinoJeton
                      denomination={toneDenomForTotal(wager.millis, wager.label)}
                      size="hero"
                      label={wager.label}
                      selected={selected}
                    />
                  </span>
                ) : (
                  <span className="pm-bj-jeton-empty-spot" aria-hidden="true" />
                )}
                {ranks.length > 0 ? (
                  <span className="pm-bj-jeton-cards" data-bj-jeton-cards="true">
                    {ranks.map((rank, index) => (
                      <span key={`${box.id}-${rank}-${index}`} className="pm-card is-mini">
                        {rank}
                      </span>
                    ))}
                  </span>
                ) : null}
                {box.outcome ? (
                  <span className="pm-bj-jeton-outcome" data-box-outcome={box.outcome}>
                    {box.outcome}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {count > 2 ? (
        <div className="pm-bj-jeton-dots" aria-hidden="true">
          {boxes.map((box) => (
            <span
              key={box.id}
              className={`pm-bj-jeton-dot${box.id === selectedBoxId ? " is-active" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export type BlackjackPlayerBoardView = "table" | "jeton";

const STORAGE_KEY = "jetonbro:blackjack-player-view";

export function readBlackjackPlayerBoardView(): BlackjackPlayerBoardView {
  if (typeof window === "undefined") return "table";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "jeton" ? "jeton" : "table";
  } catch {
    return "table";
  }
}

export function writeBlackjackPlayerBoardView(mode: BlackjackPlayerBoardView) {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore quota / private mode */
  }
}

export function BlackjackBoardViewToggle({
  mode,
  onChange,
}: {
  mode: BlackjackPlayerBoardView;
  onChange: (mode: BlackjackPlayerBoardView) => void;
}) {
  return (
    <div className="pm-bj-view-toggle" role="group" aria-label="Board view" data-bj-view-toggle="true">
      <button
        type="button"
        className={`pm-bj-view-toggle-btn${mode === "table" ? " is-active" : ""}`}
        aria-pressed={mode === "table"}
        data-bj-view="table"
        onClick={() => onChange("table")}
      >
        <span className="pm-bj-view-toggle-icon is-skull" aria-hidden="true">
          ☠
        </span>
        TABLE
      </button>
      <button
        type="button"
        className={`pm-bj-view-toggle-btn${mode === "jeton" ? " is-active" : ""}`}
        aria-pressed={mode === "jeton"}
        data-bj-view="jeton"
        onClick={() => onChange("jeton")}
      >
        <span className="pm-bj-view-toggle-icon is-stack" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        JETON
      </button>
    </div>
  );
}
