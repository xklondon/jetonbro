"use client";

import type { ReactNode } from "react";

export function DealerActionDock({
  notice,
  extra,
  primary,
  secondary,
}: {
  notice?: ReactNode;
  extra?: ReactNode;
  primary?: { label: string; disabled?: boolean; onClick: () => void } | null;
  secondary?: { label: string; disabled?: boolean; onClick: () => void; addPlayer?: boolean } | null;
}) {
  const columns = primary && secondary ? "2" : "1";
  return (
    <footer className="dock dealer-dock dealer-primary-dock" data-phase-action="true">
      {notice}
      {extra}
      <div className="dealer-action-row" data-dealer-dock="true" data-dock-columns={columns}>
        {primary ? (
          <button type="button" className="gold-button dealer-primary" disabled={primary.disabled} onClick={primary.onClick}>
            {primary.label}
          </button>
        ) : null}
        {secondary ? (
          <button
            type="button"
            className="panel-button dealer-secondary-action"
            data-add-player={secondary.addPlayer ? "true" : undefined}
            disabled={secondary.disabled}
            onClick={secondary.onClick}
          >
            {secondary.label}
          </button>
        ) : null}
      </div>
    </footer>
  );
}
