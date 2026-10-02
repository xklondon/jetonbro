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
    <div className="box dealer-box dealer-hand-row is-idle" data-dealer-box="true" data-blackjack-box-row="true">
      <span className="box-name">DEALER</span>
      <span className="hint">{name}</span>
      <span className="hint">{status}</span>
      {showDealerWon ? (
        confirm ? (
          <div className="dealer-won-confirm">
            <p>Dealer wins against all unresolved boxes?</p>
            <div className="card-assist-actions">
              <button
                type="button"
                className="gold-button"
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
          <button type="button" className="panel-button" onClick={() => setConfirm(true)}>
            DEALER WON
          </button>
        )
      ) : null}
    </div>
  );
}
