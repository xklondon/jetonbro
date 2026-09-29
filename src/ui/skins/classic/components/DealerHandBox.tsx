"use client";

import { useState } from "react";

export function DealerHandBox({
  name,
  status,
  showDealerWon,
  onDealerWon,
}: {
  name: string;
  status: string;
  showDealerWon?: boolean;
  onDealerWon?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="payout-row blackjack-box-row dealer-hand-row is-idle" data-dealer-box="true" data-blackjack-box-row="true">
      <div className="payout-row-inner">
        <div>
          <span className="dealer-tag">DEALER</span>
          <strong>{name}</strong>
          <div className="muted">{status}</div>
        </div>
        <span className="chip-pile compact" aria-hidden="true" />
      </div>
      {showDealerWon ? (
        confirm ? (
          <div className="dealer-won-confirm">
            <p>Dealer wins against all unresolved boxes?</p>
            <div className="card-assist-actions">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onDealerWon?.();
                  setConfirm(false);
                }}
              >
                Confirm
              </button>
              <button type="button" className="text-link" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="add-cards is-compact" onClick={() => setConfirm(true)}>
            DEALER WON
          </button>
        )
      ) : null}
    </div>
  );
}
