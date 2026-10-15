"use client";

import { useMemo, useState } from "react";
import type { BoxOutcome } from "@/domain/blackjack/payouts";
import type { BoxView } from "@/application/queries/views";

/** Premium payout rail — WIN → LOST → BLACKJACK → DRAW (PUSH). Domain order unchanged. */
export const PREMIUM_PAYOUT_RAIL_ORDER: BoxOutcome[] = ["WON", "LOST", "BLACKJACK", "PUSH"];

const LABELS: Record<BoxOutcome, string> = {
  WON: "WIN",
  LOST: "LOST",
  BLACKJACK: "BLACKJACK",
  PUSH: "DRAW",
};

const CLASS: Record<BoxOutcome, string> = {
  LOST: "is-lost",
  PUSH: "is-tie",
  BLACKJACK: "is-bj",
  WON: "is-win",
};

type InsuranceResolution = "DEALER_BLACKJACK" | "NO_DEALER_BLACKJACK";

function OutcomeIcon({ outcome }: { outcome: BoxOutcome }) {
  if (outcome === "LOST") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="18" fill="rgba(122, 36, 48, 0.85)" stroke="rgba(244, 234, 213, 0.55)" strokeWidth="2" />
        <path d="M16 16l16 16M32 16L16 32" stroke="#f4ead5" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (outcome === "PUSH") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="6" y="18" width="36" height="12" rx="3" fill="rgba(239, 226, 196, 0.9)" stroke="rgba(26, 18, 8, 0.45)" strokeWidth="2" />
        <path d="M14 24h20" stroke="#1a1208" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (outcome === "BLACKJACK") {
    return (
      <svg className="pm-outcome-icon" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="7" y="8" width="20" height="28" rx="3" fill="rgba(244, 234, 213, 0.95)" stroke="rgba(26, 18, 8, 0.55)" strokeWidth="1.8" transform="rotate(-12 17 22)" />
        <text x="12" y="26" fontSize="10" fontWeight="700" fill="#8b1e1e">
          A♥
        </text>
        <rect x="19" y="12" width="20" height="28" rx="3" fill="rgba(244, 234, 213, 0.95)" stroke="rgba(26, 18, 8, 0.55)" strokeWidth="1.8" transform="rotate(10 29 26)" />
        <text x="24" y="30" fontSize="10" fontWeight="700" fill="#1a1208">
          J♠
        </text>
      </svg>
    );
  }
  return (
    <svg className="pm-outcome-icon" viewBox="0 0 48 48" aria-hidden="true">
      <polygon
        points="24,4 28,18 42,18 31,27 35,41 24,33 13,41 17,27 6,18 20,18"
        fill="rgba(240, 215, 138, 0.95)"
        stroke="rgba(26, 18, 8, 0.5)"
        strokeWidth="1.6"
      />
      <rect x="11" y="20" width="26" height="12" rx="2" fill="rgba(192, 57, 43, 0.92)" stroke="rgba(26, 18, 8, 0.45)" strokeWidth="1.4" />
      <text x="24" y="29" textAnchor="middle" fontSize="8" fontWeight="800" fill="#1a1208">
        WIN
      </text>
    </svg>
  );
}

function InsuranceStatus({ box }: { box: BoxView }) {
  if (box.insuranceResult) {
    return (
      <span className="pm-bj-ins-status is-settled" data-insurance-result={box.insuranceResult}>
        {box.insuranceResult}
      </span>
    );
  }
  if (box.insurance && box.insurance.label !== "0") {
    return (
      <span className="pm-bj-ins-status is-pending" data-insurance-pending="true">
        INS PLACED · {box.insurance.label} · pending
      </span>
    );
  }
  return null;
}

function BoxSettleRow({
  box,
  enabled,
  insuranceSettleEnabled,
  onSettle,
  onSettleInsurance,
}: {
  box: BoxView;
  enabled?: boolean;
  insuranceSettleEnabled?: boolean;
  onSettle?: (outcome: BoxOutcome) => void;
  onSettleInsurance?: (resolution: InsuranceResolution) => void;
}) {
  const [pending, setPending] = useState<BoxOutcome | null>(null);
  const settled = box.outcome ?? pending;
  const unresolved = Boolean(enabled && !box.outcome && onSettle);
  const showInsSettle = Boolean(
    insuranceSettleEnabled && box.insurance && box.insurance.label !== "0" && !box.insuranceResult && onSettleInsurance,
  );

  return (
    <div
      className={`pm-bj-payout-box${settled ? " is-settled" : unresolved ? " is-unresolved" : ""}`}
      data-payout-rail="row"
      data-box-id={box.id}
      data-box-number={box.boxNumber}
      data-payout-state={settled ?? "pending"}
    >
      <div className="pm-bj-payout-box-head">
        <strong>BOX {box.boxNumber}</strong>
        <span data-field="main-bet">
          MAIN BET {box.bet.label}
          {box.isDoubled ? " · 2×" : ""}
          {box.isSplit ? " · SPLIT" : ""}
        </span>
        <InsuranceStatus box={box} />
      </div>
      {settled ? (
        <div className={`pm-bj-payout-result ${CLASS[settled]}`} data-box-result={settled}>
          <OutcomeIcon outcome={settled} />
          <strong>{LABELS[settled]}</strong>
          {box.returned?.label ? <em>{box.returned.label}</em> : null}
        </div>
      ) : (
        <div className="pm-bj-payout-actions" role="group" aria-label={`Settle Box ${box.boxNumber}`}>
          {PREMIUM_PAYOUT_RAIL_ORDER.map((outcome) => (
            <button
              key={outcome}
              type="button"
              className={`${CLASS[outcome]}${pending === outcome ? " is-selected" : ""}`}
              data-payout-action="true"
              data-outcome={outcome}
              aria-label={`Set Box ${box.boxNumber} result: ${LABELS[outcome]}`}
              aria-pressed={pending === outcome}
              disabled={!unresolved}
              onClick={() => {
                setPending(outcome);
                onSettle?.(outcome);
              }}
            >
              <OutcomeIcon outcome={outcome} />
              <span>{LABELS[outcome]}</span>
            </button>
          ))}
        </div>
      )}
      {showInsSettle ? (
        <div className="pm-bj-ins-settle" role="group" aria-label={`Settle insurance · Box ${box.boxNumber}`}>
          <button
            type="button"
            className="pm-bj-ins-btn is-won"
            data-insurance-action="won"
            onClick={() => onSettleInsurance?.("DEALER_BLACKJACK")}
          >
            INS WON
          </button>
          <button
            type="button"
            className="pm-bj-ins-btn is-lost"
            data-insurance-action="lost"
            onClick={() => onSettleInsurance?.("NO_DEALER_BLACKJACK")}
          >
            INS LOST
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Player-grouped payout overlay — one panel per player, one row per factual box. */
export function BlackjackPayoutOverlay({
  boxes,
  enabled,
  insuranceSettleEnabled,
  onSettle,
  onSettleInsurance,
}: {
  boxes: BoxView[];
  enabled?: boolean;
  insuranceSettleEnabled?: boolean;
  onSettle?: (boxId: string, outcome: BoxOutcome) => void;
  onSettleInsurance?: (resolution: InsuranceResolution) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { playerId: string; playerName: string; boxes: BoxView[] }>();
    for (const box of boxes) {
      const key = box.playerId || box.playerName || box.id;
      const existing = map.get(key);
      if (existing) existing.boxes.push(box);
      else map.set(key, { playerId: key, playerName: box.playerName || "Player", boxes: [box] });
    }
    return [...map.values()];
  }, [boxes]);

  return (
    <div className="pm-bj-payout" data-bj-layout="payout" data-payout-overlay="true">
      {groups.map((group) => (
        <section
          key={group.playerId}
          className="pm-bj-payout-panel"
          data-player-group={group.playerId}
          data-player-row="true"
        >
          {groups.length > 1 ? (
            <header className="pm-bj-payout-panel-head">
              <strong>{group.playerName}</strong>
            </header>
          ) : null}
          {group.boxes.map((box) => (
            <BoxSettleRow
              key={box.id}
              box={box}
              enabled={enabled}
              insuranceSettleEnabled={insuranceSettleEnabled}
              onSettle={onSettle ? (outcome) => onSettle(box.id, outcome) : undefined}
              onSettleInsurance={onSettleInsurance}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
